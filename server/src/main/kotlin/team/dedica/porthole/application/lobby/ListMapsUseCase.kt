package team.dedica.porthole.application.lobby

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
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
