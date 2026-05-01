package team.dedica.porthole.application.lobby

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class JoinMapUseCase(
    private val sessionStatePort: SessionStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(id: UUID, callerId: UUID): SessionState {
        val state = sessionStatePort.findById(id)
            ?: throw NoSuchElementException("Map $id not found")
        if (state.collaborationMode != CollaborationMode.OPEN) {
            throw IllegalStateException("This map requires a join request")
        }
        val user = userPort.findById(callerId)
            ?: throw NoSuchElementException("User $callerId not found")
        require(state.getCollaborator(user.id) == null) { "Collaborator already in session" }

        state.collaborators.add(Collaborator(id = user.id, username = user.username, avatarUrl = user.avatarUrl))
        sessionStatePort.save(state)
        broadcastPort.send(id, state)
        return state
    }
}
