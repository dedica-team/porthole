package team.dedica.porthole.application.session.game

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GameState
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

/** Removes a collaborator from the watchtower they are currently manning. */
@Singleton
class LeaveWatchtowerUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID, landmarkId: UUID): GameState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)

        val occupant = state.gameState.towerOccupants[landmarkId]
        if (occupant == callerId) {
            state.gameState.towerOccupants.remove(landmarkId)
            sessionStatePort.save(state)
            broadcastPort.sendGame(sessionId, state.gameState)
        }
        return state.gameState
    }
}
