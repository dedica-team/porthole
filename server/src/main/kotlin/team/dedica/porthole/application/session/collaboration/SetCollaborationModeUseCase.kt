package team.dedica.porthole.application.session.collaboration

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class SetCollaborationModeUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionID: UUID, callerId: UUID, mode: CollaborationMode): SessionState {
        authorizationPort.accessSession(callerId, sessionID, SessionRole.COLLABORATOR)

        val state = sessionStatePort.findById(sessionID)
            ?: throw NoSuchElementException("Map $sessionID not found")
        val updated = state.copy(collaborationMode = mode)
        sessionStatePort.save(updated)
        broadcastPort.send(sessionID, updated)
        return updated
    }
}