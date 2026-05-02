package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Component
class GetCollaboratorMatrixUseCase(
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID): CollaboratorMatrix {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.VIEWER)
        return state.collaboratorMatrix
    }
}
