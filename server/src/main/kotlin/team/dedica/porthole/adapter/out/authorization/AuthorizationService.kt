package team.dedica.porthole.adapter.out.authorization

import jakarta.inject.Singleton
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
class AuthorizationService(
    private val adminService: AdminService,
    private val sessionStatePort: SessionStatePort,
) : AuthorizationPort {

    override fun accessSession(userId: UUID, sessionId: UUID, requiredRole: SessionRole): SessionState {

        val state = sessionStatePort.findById(sessionId) ?: throw NoSuchElementException("Session $sessionId not found")

        if (adminService.isAdmin(userId)) {
            return state
        }

        val role = when {
            state.isCollaborator(userId)    -> SessionRole.COLLABORATOR
            state.hasPendingRequest(userId) -> SessionRole.REQUEST_PENDING
            else                            -> SessionRole.VIEWER
        }
        role.mustHaveRole(requiredRole)

        return state
    }
}

