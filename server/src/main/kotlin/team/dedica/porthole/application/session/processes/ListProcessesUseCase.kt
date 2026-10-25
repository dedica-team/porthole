package team.dedica.porthole.application.session.processes

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class ListProcessesUseCase(
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID): List<Process> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.VIEWER)
        return state.processes.values.sortedBy { it.name }
    }
}
