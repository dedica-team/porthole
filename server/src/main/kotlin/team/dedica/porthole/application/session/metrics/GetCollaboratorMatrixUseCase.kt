package team.dedica.porthole.application.session.metrics

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class GetCollaboratorMatrixUseCase(
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID): CollaboratorMatrix {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.VIEWER)
        return state.collaboratorMatrix
    }
}
