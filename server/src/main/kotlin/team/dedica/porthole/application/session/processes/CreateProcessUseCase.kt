package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Component
class CreateProcessUseCase(
    private val sessionStatePort: SessionStatePort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(mapId: UUID, name: String, description: String?, callerId: UUID): List<Process> {
        val state = authorizationPort.accessSession(callerId, mapId, SessionRole.COLLABORATOR)
        val trimmed = name.trim()
        require(trimmed.isNotBlank()) { "Process name must not be blank" }
        val process = Process(name = trimmed, description = description?.trim()?.takeIf { it.isNotBlank() })
        state.processes[process.id] = process
        sessionStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}
