package team.dedica.porthole.application.lobby

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class GetMapUseCase(
    private val sessionStatePort: SessionStatePort,
    private val userPort: UserPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID?): SessionState {
        val state = sessionStatePort.findById(sessionId)
            ?: throw NoSuchElementException("Session $sessionId not found")

        // Private map visibility check
        if (state.collaborationMode == CollaborationMode.PRIVATE) {
            if (callerId == null) throw org.springframework.security.access.AccessDeniedException("Authentication required")
            authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        }

        // Refresh each collaborator's avatarUrl from the current UserRecord
        val refreshed = state.collaborators.map { collaborator ->
            val freshAvatar = userPort.findByUsername(collaborator.username)?.avatarUrl
            if (freshAvatar != null && freshAvatar != collaborator.avatarUrl)
                collaborator.copy(avatarUrl = freshAvatar)
            else collaborator
        }
        val patched = refreshed != state.collaborators
        if (patched) {
            state.collaborators.clear()
            state.collaborators.addAll(refreshed)
            sessionStatePort.save(state)
        }

        return state
    }
}