package team.dedica.porthole.application.session.chorelists

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Component
class ListChoreListsUseCase(
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID): List<ChoreList> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.VIEWER)
        return state.choreLists.values.sortedBy { it.title }
    }
}
