package team.dedica.porthole.application.session.game

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GameGeometry
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.Vec3
import java.util.UUID

data class ShootResult(
    val hit: Boolean,
    val bugId: String? = null,
)

private const val MAX_ORIGIN_DRIFT = 2.0

/**
 * Resolves a ballistic shot server-side. The client only provides the camera origin and
 * aim direction; the server decides whether a bug was hit and removes it from the map.
 */
@Singleton
class ShootUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        callerId: UUID,
        origin: Vec3,
        direction: Vec3,
    ): ShootResult {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        require(state.gameEnabled) { "Tower-defense game is not enabled for this session" }
        val game = state.gameState
        val towerId = game.towerOccupants.entries.firstOrNull { it.value == callerId }?.key
            ?: throw IllegalArgumentException("You must be inside a watchtower to shoot")
        val tower = state.landmarks[towerId]
            ?: throw IllegalArgumentException("Watchtower $towerId not found")
        val eye = GameGeometry.towerEyePosition(state, tower)
            ?: throw IllegalArgumentException("Watchtower ${tower.name} has no position")
        require(origin.minus(eye).length() <= MAX_ORIGIN_DRIFT) {
            "Shot origin is not at your watchtower"
        }
        require(GameGeometry.isValidDirection(direction)) { "Invalid aim direction" }
        val bug = GameGeometry.findHit(state, game, origin, direction)
            ?: return ShootResult(hit = false)

        game.bugs.remove(bug.id)
        state.gameState = game
        sessionStatePort.save(state)
        broadcastPort.sendGame(sessionId, game)
        return ShootResult(hit = true, bugId = bug.id.toString())
    }
}
