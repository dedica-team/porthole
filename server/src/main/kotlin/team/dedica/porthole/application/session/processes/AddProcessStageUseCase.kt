package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.ProcessStage

@Component
class AddProcessStageUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
) {
    fun execute(mapId: String, processId: String, name: String?, order: Int, username: String): List<Process> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val process = state.processes[processId]
            ?: throw NoSuchElementException("Process $processId not found")
        val stage = ProcessStage(
            name = name?.trim()?.takeIf { it.isNotBlank() },
            order = order,
        )
        process.stages.add(stage)
        process.stages.sortBy { it.order }
        mapStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}

