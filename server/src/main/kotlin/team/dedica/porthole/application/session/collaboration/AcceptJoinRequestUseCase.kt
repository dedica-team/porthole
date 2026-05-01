package team.dedica.porthole.application.session.collaboration

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class AcceptJoinRequestUseCase(
    private val sessionStatePort: SessionStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, acceptorId: UUID, requestId: UUID): SessionState {

        val state =authorizationPort.accessSession(acceptorId, sessionId,SessionRole.COLLABORATOR)

        val joinRequest = state.joinRequests.find { it.id == requestId }
            ?: throw NoSuchElementException("Join request $requestId not found")

        state.joinRequests.remove(joinRequest)

        // Look up the requester to get their fresh avatar
        val requesterUser = userPort.findByUsername(joinRequest.username)
        state.collaborators.add(
            Collaborator(
                id = joinRequest.userId,
                username = joinRequest.username,
                avatarUrl = requesterUser?.avatarUrl ?: joinRequest.avatarUrl,
            )
        )
        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}