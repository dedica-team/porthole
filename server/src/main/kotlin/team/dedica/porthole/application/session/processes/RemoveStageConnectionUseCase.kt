package team.dedica.porthole.application.session.processes

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class RemoveStageConnectionUseCase(
    private val sessionStatePort: SessionStatePort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, processId: UUID?, stageId: UUID?, stageConnId: UUID?, callerId: UUID): List<Process> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val process = state.processes[processId] ?: throw NoSuchElementException("Process $processId not found")
        val stage = process.stages.find { it.id == stageId } ?: throw NoSuchElementException("Stage $stageId not found in process $processId")
        stage.connections.removeIf { it.id == stageConnId }
        sessionStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}
