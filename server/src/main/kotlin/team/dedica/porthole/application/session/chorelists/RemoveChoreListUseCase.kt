package team.dedica.porthole.application.session.chorelists

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Component
class RemoveChoreListUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, listId: UUID, callerId: UUID) {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        require(state.choreLists.containsKey(listId)) { "Chore list $listId not found" }
        state.choreLists.remove(listId)
        sessionStatePort.save(state)
        broadcastPort.sendChoreLists(sessionId, state.choreLists)
    }
}
