package team.dedica.porthole.application.lobby

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.MapState

@Component
class JoinMapUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(id: String, username: String): MapState {
        val state = mapStatePort.findById(id)
            ?: throw NoSuchElementException("Map $id not found")
        if (state.collaborationMode != CollaborationMode.OPEN) {
            throw IllegalStateException("This map requires a join request")
        }
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        require(state.getCollaborator(user.id) == null) { "Collaborator already in session" }

        state.collaborators.add(Collaborator(id = user.id, username = user.username, avatarUrl = user.avatarUrl))
        mapStatePort.save(state)
        broadcastPort.send(id, state)
        return state
    }
}
