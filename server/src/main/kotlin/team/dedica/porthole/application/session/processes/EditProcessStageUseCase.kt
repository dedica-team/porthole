package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Process

@Component
class EditProcessStageUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
) {
    fun execute(
        mapId: String,
        processId: String,
        stageId: String,
        name: String?,
        clearName: Boolean,
        order: Int?,
        username: String,
    ): List<Process> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val process = state.processes[processId]
            ?: throw NoSuchElementException("Process $processId not found")
        val idx = process.stages.indexOfFirst { it.id == stageId }
        if (idx < 0) throw NoSuchElementException("Stage $stageId not found in process $processId")

        val stage = process.stages[idx]
        val newName = when {
            clearName -> null
            name != null -> name.trim().takeIf { it.isNotBlank() } ?: stage.name
            else -> stage.name
        }
        val newOrder = order ?: stage.order
        process.stages[idx] = stage.copy(name = newName, order = newOrder)
        process.stages.sortBy { it.order }
        mapStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}

