package team.dedica.porthole.application.session.landscaping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GameState
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
class EditMapUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        callerId: UUID,
        name: String?,
        description: String?,
        gameEnabled: Boolean? = null,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val newName = name?.trim()?.ifBlank { null }
        val newDescription = description?.trim()?.ifBlank { null }
        val updated = state.copy(
            name = newName,
            description = newDescription,
            gameEnabled = gameEnabled ?: state.gameEnabled,
            // Disabling the game must stop all mechanics and clear any running wave.
            gameState = if (gameEnabled == false) GameState() else state.gameState,
        )
        sessionStatePort.save(updated)
        broadcastPort.send(sessionId, updated)
        return updated
    }
}
