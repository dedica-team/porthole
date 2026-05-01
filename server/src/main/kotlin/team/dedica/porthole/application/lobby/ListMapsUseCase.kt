package team.dedica.porthole.application.lobby

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class ListMapsUseCase(
    private val sessionStatePort: SessionStatePort,
) {
    fun execute(callerId: UUID? = null): List<SessionState> {
        return sessionStatePort.findAll().filter { state ->
            state.collaborationMode != CollaborationMode.PRIVATE ||
                (callerId != null && state.isCollaborator(callerId))
        }
    }
}
