package team.dedica.porthole.application.session.landscaping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
class RemoveConnectionUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, connectionId: UUID, callerId: UUID): SessionState {

        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        require(state.connections.containsKey(connectionId)) { "Connection $connectionId not found" }
        state.connections.remove(connectionId)
        // Cascade: remove StageConnection entries referencing this connection
        var processesChanged = false
        state.processes.values.forEach { process ->
            process.stages.forEach { stage ->
                if (stage.connections.removeIf { it.connectionId == connectionId }) processesChanged = true
            }
        }
        sessionStatePort.save(state)
        if (processesChanged) broadcastPort.sendProcesses(sessionId)
        broadcastPort.send(sessionId, state)
        return state
    }
}
