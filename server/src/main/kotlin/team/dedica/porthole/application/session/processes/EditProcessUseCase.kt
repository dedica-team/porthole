package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Component
class EditProcessUseCase(
    private val sessionStatePort: SessionStatePort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(mapId: UUID, processId: UUID, name: String?, description: String?, callerId: UUID): List<Process> {
        val state = authorizationPort.accessSession(callerId, mapId, SessionRole.COLLABORATOR)
        val process = state.processes[processId] ?: throw NoSuchElementException("Process $processId not found")
        name?.trim()?.takeIf { it.isNotBlank() }?.let { process.name = it }
        description?.let { process.description = it.trim().takeIf { d -> d.isNotBlank() } }
        sessionStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}
