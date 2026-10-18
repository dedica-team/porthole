package team.dedica.porthole.application.lobby

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
class AdminJoinMapUseCase(
    private val sessionStatePort: SessionStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId,SessionRole.ADMIN)
        val user = userPort.findById(callerId)
            ?: throw NoSuchElementException("User $callerId not found")

        if (state.getCollaborator(user.id) == null) {
            state.collaborators.add(Collaborator(id = user.id, username = user.username, avatarUrl = user.avatarUrl))
            sessionStatePort.save(state)
            broadcastPort.send(sessionId, state)
        }
        return state
    }
}
