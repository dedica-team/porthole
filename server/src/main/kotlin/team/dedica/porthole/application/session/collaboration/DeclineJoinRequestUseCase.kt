package team.dedica.porthole.application.session.collaboration

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.MapState
import java.util.UUID

@Component
class DeclineJoinRequestUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: UUID, declinerUsername: String, requestId: UUID): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val decliner = userPort.findByUsername(declinerUsername)
            ?: throw NoSuchElementException("User $declinerUsername not found")
        state.requireCollaborator(decliner.id)

        val joinRequest = state.joinRequests.find { it.id == requestId }
            ?: throw NoSuchElementException("Join request $requestId not found")

        state.joinRequests.remove(joinRequest)
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}