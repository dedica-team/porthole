package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.StageConnectionDirection
import java.util.UUID

@Component
class EditStageConnectionUseCase(
    private val sessionStatePort: SessionStatePort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        processId: UUID,
        stageId: UUID,
        stageConnId: UUID,
        title: String?,
        clearTitle: Boolean,
        direction: String?,
        callerId: UUID,
    ): List<Process> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
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
        sessionStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}
