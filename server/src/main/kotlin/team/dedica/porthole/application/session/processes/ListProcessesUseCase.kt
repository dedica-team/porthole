package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Component
class ListProcessesUseCase(
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(mapId: UUID, callerId: UUID): List<Process> {
        val state = authorizationPort.accessSession(callerId, mapId, SessionRole.VIEWER)
        return state.processes.values.sortedBy { it.name }
    }
}
