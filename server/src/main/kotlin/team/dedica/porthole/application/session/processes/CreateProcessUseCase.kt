package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Process

@Component
class CreateProcessUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
) {
    fun execute(mapId: String, name: String, description: String?, username: String): List<Process> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val trimmed = name.trim()
        require(trimmed.isNotBlank()) { "Process name must not be blank" }
        val process = Process(
            name = trimmed,
            description = description?.trim()?.takeIf { it.isNotBlank() },
        )
        state.processes[process.id] = process
        mapStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}

