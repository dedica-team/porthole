package team.dedica.porthole.application.lobby

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.JoinRequest
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class RequestJoinUseCase(
    private val sessionStatePort: SessionStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: UUID, callerId: UUID): SessionState {
        val state = sessionStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findById(callerId)
            ?: throw NoSuchElementException("User $callerId not found")

        require(state.collaborationMode != CollaborationMode.OPEN) {
            "This map is open – use join directly"
        }
        require(!state.isCollaborator(user.id)) {
            "User ${user.username} is already a collaborator"
        }
        require(!state.hasPendingRequest(user.id)) {
            "A join request from ${user.username} is already pending"
        }

        state.joinRequests.add(
            JoinRequest(userId = user.id, username = user.username, avatarUrl = user.avatarUrl)
        )
        sessionStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}