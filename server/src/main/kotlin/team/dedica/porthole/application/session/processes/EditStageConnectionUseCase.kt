package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.StageConnectionDirection

@Component
class EditStageConnectionUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
) {
    fun execute(
        mapId: String,
        processId: String,
        stageId: String,
        stageConnId: String,
        title: String?,
        clearTitle: Boolean,
        direction: String?,
        username: String,
    ): List<Process> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val process = state.processes[processId]
            ?: throw NoSuchElementException("Process $processId not found")
        val stage = process.stages.find { it.id == stageId }
            ?: throw NoSuchElementException("Stage $stageId not found in process $processId")
        val idx = stage.connections.indexOfFirst { it.id == stageConnId }
        if (idx < 0) throw NoSuchElementException("StageConnection $stageConnId not found")
        val sc = stage.connections[idx]
        val newTitle = when {
            clearTitle -> null
            title != null -> title.trim().takeIf { it.isNotBlank() }
            else -> sc.title
        }
        val newDirection = direction?.let {
            runCatching { StageConnectionDirection.valueOf(it) }.getOrNull()
        } ?: sc.direction
        stage.connections[idx] = sc.copy(title = newTitle, direction = newDirection)
        mapStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}

