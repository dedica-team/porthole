package team.dedica.porthole.application.session.processes

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.StageConnection
import team.dedica.porthole.domain.StageConnectionDirection
import java.util.UUID

@Component
class AddStageConnectionUseCase(
    private val sessionStatePort: SessionStatePort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        processId: UUID?,
        stageId: UUID?,
        connectionId: UUID,
        title: String?,
        direction: String,
        callerId: UUID
    ): List<Process> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
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
        sessionStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}
