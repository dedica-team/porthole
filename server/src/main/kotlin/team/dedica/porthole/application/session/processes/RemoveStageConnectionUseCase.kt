package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Process

@Component
class RemoveStageConnectionUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
) {
    fun execute(mapId: String, processId: String, stageId: String, stageConnId: String, username: String): List<Process> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val process = state.processes[processId]
            ?: throw NoSuchElementException("Process $processId not found")
        val stage = process.stages.find { it.id == stageId }
            ?: throw NoSuchElementException("Stage $stageId not found in process $processId")
        stage.connections.removeIf { it.id == stageConnId }
        mapStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}

