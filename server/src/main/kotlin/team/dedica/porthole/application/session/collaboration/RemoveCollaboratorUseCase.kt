package team.dedica.porthole.application.session.collaboration

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.session.greenkeeping.RemoveCollaboratorFromGreenkeepingRotationsUseCase
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class RemoveCollaboratorUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
    private val removeCollaboratorFromGreenkeepingRotationsUseCase: RemoveCollaboratorFromGreenkeepingRotationsUseCase,
) {
    /**
     * Removes [collaboratorId] from the session.
     * Only an admin may do this. A collaborator cannot remove themselves via this
     * use case (that would be a "leave" action and is out of scope here).
     */
    fun execute(sessionId: UUID, callerId: UUID, collaboratorId: UUID): SessionState {

        val state = authorizationPort.accessSession(callerId, sessionId,SessionRole.ADMIN)

        val removed = state.collaborators.removeIf { it.id == collaboratorId }
        if (!removed) throw NoSuchElementException("Collaborator $collaboratorId not found in session $sessionId")
        removeCollaboratorFromGreenkeepingRotationsUseCase.execute(state, collaboratorId)
        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        broadcastPort.sendGreenkeepingRotations(sessionId, state.greenkeepingRotations)
        return state
    }
}
