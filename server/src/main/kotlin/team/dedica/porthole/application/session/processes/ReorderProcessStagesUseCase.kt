package team.dedica.porthole.application.session.processes

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class ReorderProcessStagesUseCase(
    private val sessionStatePort: SessionStatePort,
    private val authorizationPort: AuthorizationPort,
) {
    /**
     * Accepts an ordered list of stage IDs and reassigns their `order` field
     * to match the position in the list (0-based).
     */
    fun execute(sessionId: UUID, processId: UUID, stageIds: List<UUID>, callerId: UUID): List<Process> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
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
        sessionStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}
