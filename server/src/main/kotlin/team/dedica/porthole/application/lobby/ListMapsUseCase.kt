package team.dedica.porthole.application.lobby

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.MapState

@Component
class ListMapsUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
) {
    fun execute(callerUsername: String? = null): List<MapState> {
        val callerId = callerUsername?.let { userPort.findByUsername(it)?.id }
        return mapStatePort.findAll().filter { state ->
            state.collaborationMode != CollaborationMode.PRIVATE ||
                (callerId != null && state.isCollaborator(callerId))
        }
    }
}
