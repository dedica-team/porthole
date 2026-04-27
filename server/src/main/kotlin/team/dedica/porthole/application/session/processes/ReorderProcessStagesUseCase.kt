package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Process

@Component
class ReorderProcessStagesUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
) {
    /**
     * Accepts an ordered list of stage IDs and reassigns their `order` field
     * to match the position in the list (0-based).
     */
    fun execute(mapId: String, processId: String, stageIds: List<String>, username: String): List<Process> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val process = state.processes[processId]
            ?: throw NoSuchElementException("Process $processId not found")
        require(stageIds.size == process.stages.size) {
            "Stage ID list size ${stageIds.size} does not match process stage count ${process.stages.size}"
        }
        stageIds.forEachIndexed { newOrder, stageId ->
            val idx = process.stages.indexOfFirst { it.id == stageId }
            require(idx >= 0) { "Stage $stageId not found in process $processId" }
            process.stages[idx] = process.stages[idx].copy(order = newOrder)
        }
        process.stages.sortBy { it.order }
        mapStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}

