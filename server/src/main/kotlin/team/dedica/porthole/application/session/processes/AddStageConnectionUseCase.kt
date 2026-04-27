package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.StageConnection
import team.dedica.porthole.domain.StageConnectionDirection

@Component
class AddStageConnectionUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
) {
    fun execute(
        mapId: String,
        processId: String,
        stageId: String,
        connectionId: String,
        title: String?,
        direction: String,
        username: String,
    ): List<Process> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        require(state.connections.containsKey(connectionId)) { "Connection $connectionId not found" }
        val process = state.processes[processId]
            ?: throw NoSuchElementException("Process $processId not found")
        val stage = process.stages.find { it.id == stageId }
            ?: throw NoSuchElementException("Stage $stageId not found in process $processId")
        // Prevent duplicate underlying connection in the same stage
        if (stage.connections.none { it.connectionId == connectionId }) {
            val dir = runCatching { StageConnectionDirection.valueOf(direction) }
                .getOrDefault(StageConnectionDirection.FORWARD)
            stage.connections.add(StageConnection(connectionId = connectionId, title = title, direction = dir))
        }
        mapStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}

