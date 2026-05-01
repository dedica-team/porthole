package team.dedica.porthole.application.port

import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

interface AuthorizationPort {
    /**
     * Returns the role of [userId] with respect to the given session.
     * Use cases call this and then check via role.mustHaveRole(required).
     */
    fun accessSession(userId: UUID, sessionId: UUID, requiredRole: SessionRole): SessionState
}

