package team.dedica.porthole.application.session.chorelists

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class ToggleChoreListCompletedUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, listId: UUID, callerId: UUID): ChoreList {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val list = state.choreLists[listId] ?: throw NoSuchElementException("Chore list $listId not found")
        list.completed = !list.completed
        sessionStatePort.save(state)
        broadcastPort.sendChoreLists(sessionId, state.choreLists)
        return list
    }
}
