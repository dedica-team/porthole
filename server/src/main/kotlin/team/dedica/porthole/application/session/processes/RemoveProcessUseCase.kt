package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.Process
import java.util.UUID

@Component
class RemoveProcessUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
) {
    fun execute(mapId: UUID, processId: String, username: String): List<Process> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val processUuid = UUID.fromString(processId)
        require(state.processes.containsKey(processUuid)) { "Process $processId not found" }
        state.processes.remove(processUuid)
        mapStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}

