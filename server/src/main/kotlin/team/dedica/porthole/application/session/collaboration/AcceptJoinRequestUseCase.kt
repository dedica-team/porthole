package team.dedica.porthole.application.session.collaboration

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.MapState

@Component
class AcceptJoinRequestUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, acceptorUsername: String, requestId: String): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val acceptor = userPort.findByUsername(acceptorUsername)
            ?: throw NoSuchElementException("User $acceptorUsername not found")
        state.requireCollaborator(acceptor.id)

        val joinRequest = state.joinRequests.find { it.id == requestId }
            ?: throw NoSuchElementException("Join request $requestId not found")

        state.joinRequests.remove(joinRequest)

        // Look up the requester to get their fresh avatar
        val requesterUser = userPort.findByUsername(joinRequest.username)
        state.collaborators.add(
            Collaborator(
                id = joinRequest.userId,
                username = joinRequest.username,
                avatarUrl = requesterUser?.avatarUrl ?: joinRequest.avatarUrl,
            )
        )
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}