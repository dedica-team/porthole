package team.dedica.porthole.application.session.game

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GameEngine
import team.dedica.porthole.domain.GameState
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.SessionRole
import java.time.Instant
import java.util.UUID

/**
 * Puts a collaborator inside a watchtower. The first occupant arms the wave simulation.
 * A watchtower can only be manned by one collaborator at a time.
 */
@Singleton
class EnterWatchtowerUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        callerId: UUID,
        landmarkId: UUID,
        now: Instant = Instant.now(),
    ): GameState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        require(state.gameEnabled) { "Tower-defense game is not enabled for this session" }
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        require(landmark.type == LandmarkType.WATCHTOWER) {
            "Landmark ${landmark.name} is not a watchtower"
        }
        val health = state.gameState.buildingHealth[landmarkId] ?: state.gameState.buildingMaxHealth
        require(health > 0) {
            "Watchtower ${landmark.name} has no health and cannot be manned"
        }

        val occupant = state.gameState.towerOccupants[landmarkId]
        require(occupant == null || occupant == callerId) {
            "Watchtower ${landmark.name} is already occupied"
        }

        state.gameState.towerOccupants[landmarkId] = callerId
        state.gameState = GameEngine.start(state, now)

        sessionStatePort.save(state)
        broadcastPort.sendGame(sessionId, state.gameState)
        return state.gameState
    }
}
