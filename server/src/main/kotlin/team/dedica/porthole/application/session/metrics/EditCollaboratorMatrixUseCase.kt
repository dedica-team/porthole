package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class EditCollaboratorMatrixUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID, name: String): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        require(name.isNotBlank()) { "Matrix name must not be blank" }
        state.collaboratorMatrix = state.collaboratorMatrix.copy(name = name.trim())
        sessionStatePort.save(state)
        broadcastPort.sendMatrix(sessionId, state.collaboratorMatrix)
        return state
    }
}