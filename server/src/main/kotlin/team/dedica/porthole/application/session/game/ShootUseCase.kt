package team.dedica.porthole.application.session.game

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GameEngine
import team.dedica.porthole.domain.GameGeometry
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.Vec3
import java.util.UUID

data class ShootResult(
    val hit: Boolean,
    val bugId: String? = null,
    val landmarkId: String? = null,
    val hitPosition: Vec3? = null,
)

private const val MAX_ORIGIN_DRIFT = 0.75

/**
 * Resolves a ballistic shot server-side. The client only provides the camera origin and
 * aim direction; the server decides whether a bug or building was hit.
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
        require(tower.type == LandmarkType.WATCHTOWER) {
            "Watchtower ${tower.name} is ruins and cannot shoot"
        }
        val towerHealth = game.buildingHealth[towerId] ?: game.buildingMaxHealth
        require(towerHealth > 0) {
            "Watchtower ${tower.name} has no health and cannot shoot"
        }
        val eye = GameGeometry.towerEyePosition(state, tower)
            ?: throw IllegalArgumentException("Watchtower ${tower.name} has no position")
        require(origin.minus(eye).length() <= MAX_ORIGIN_DRIFT) {
            "Shot origin is not at your watchtower"
        }
        require(GameGeometry.isValidDirection(direction)) { "Invalid aim direction" }

        val hitTarget = GameGeometry.findHitTarget(state, game, origin, direction, shooterTowerId = towerId)
            ?: return ShootResult(hit = false)

        if (hitTarget.bug != null) {
            game.bugs.remove(hitTarget.bug.id)
            state.gameState = game
            sessionStatePort.save(state)
            broadcastPort.sendGame(sessionId, game)
            return ShootResult(
                hit = true,
                bugId = hitTarget.bug.id.toString(),
                hitPosition = hitTarget.hitPoint,
            )
        }

        if (hitTarget.landmark != null) {
            val building = hitTarget.landmark
            val currentHealth = game.buildingHealth[building.id] ?: game.buildingMaxHealth
            val remaining = (currentHealth - 1).coerceAtLeast(0)
            game.buildingHealth[building.id] = remaining
            val destroyed = remaining == 0
            if (destroyed) {
                GameEngine.destroyBuilding(state, game, building.id)
            }
            state.gameState = game
            sessionStatePort.save(state)
            broadcastPort.sendGame(sessionId, game)
            if (destroyed) {
                broadcastPort.send(sessionId, state)
            }
            return ShootResult(
                hit = true,
                landmarkId = building.id.toString(),
                hitPosition = hitTarget.hitPoint,
            )
        }

        return ShootResult(hit = false)
    }
}
