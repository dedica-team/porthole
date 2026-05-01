package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.Process
import java.util.UUID

@Component
class EditProcessUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
) {
    fun execute(mapId: UUID, processId: String, name: String?, description: String?, username: String): List<Process> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val process = state.processes[UUID.fromString(processId)]
            ?: throw NoSuchElementException("Process $processId not found")
        name?.trim()?.takeIf { it.isNotBlank() }?.let { process.name = it }
        description?.let { process.description = it.trim().takeIf { d -> d.isNotBlank() } }
        mapStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}

