package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Process

@Component
class RemoveProcessStageUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
) {
    fun execute(mapId: String, processId: String, stageId: String, username: String): List<Process> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val process = state.processes[processId]
            ?: throw NoSuchElementException("Process $processId not found")
        val removed = process.stages.removeIf { it.id == stageId }
        require(removed) { "Stage $stageId not found in process $processId" }
        mapStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}

