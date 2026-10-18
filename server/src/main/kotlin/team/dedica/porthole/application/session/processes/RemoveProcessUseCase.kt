package team.dedica.porthole.application.session.processes

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class RemoveProcessUseCase(
    private val sessionStatePort: SessionStatePort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, processId: UUID, callerId: UUID): List<Process> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        require(state.processes.containsKey(processId)) { "Process $processId not found" }
        state.processes.remove(processId)
        sessionStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}
