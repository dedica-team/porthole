package team.dedica.porthole.application.lobby

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.JoinRequest
import team.dedica.porthole.domain.MapState
import java.util.UUID

@Component
class RequestJoinUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: UUID, username: String): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")

        require(state.collaborationMode != CollaborationMode.OPEN) {
            "This map is open – use join directly"
        }
        require(!state.isCollaborator(user.id)) {
            "User $username is already a collaborator"
        }
        require(!state.hasPendingRequest(user.id)) {
            "A join request from $username is already pending"
        }

        state.joinRequests.add(
            JoinRequest(userId = user.id, username = user.username, avatarUrl = user.avatarUrl)
        )
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}