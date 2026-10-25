package team.dedica.porthole.application.session.collaboration

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.*

@Singleton
class DeclineJoinRequestUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, declinerId: UUID, requestId: UUID): SessionState {

        val state = authorizationPort.accessSession(declinerId, sessionId, SessionRole.COLLABORATOR)

        val joinRequest = state.joinRequests.find { it.id == requestId }
            ?: throw NoSuchElementException("Join request $requestId not found")

        state.joinRequests.remove(joinRequest)
        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}