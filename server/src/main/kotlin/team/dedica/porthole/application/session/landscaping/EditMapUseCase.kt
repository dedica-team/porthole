package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
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
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val newName = name?.trim()?.ifBlank { null }
        val newDescription = description?.trim()?.ifBlank { null }
        val updated = state.copy(name = newName, description = newDescription)
        sessionStatePort.save(updated)
        broadcastPort.send(sessionId, updated)
        return updated
    }
}
