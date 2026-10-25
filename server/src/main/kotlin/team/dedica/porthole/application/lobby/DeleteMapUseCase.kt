package team.dedica.porthole.application.lobby

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class DeleteMapUseCase(
    private val sessionStatePort: SessionStatePort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerUserId: UUID) {
        authorizationPort.accessSession(callerUserId, sessionId,SessionRole.ADMIN)
        sessionStatePort.findById(sessionId) ?: throw NoSuchElementException("Session $sessionId not found")
        sessionStatePort.delete(sessionId)
    }
}
