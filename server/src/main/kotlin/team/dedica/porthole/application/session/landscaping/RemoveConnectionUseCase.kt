package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.MapState
import java.util.UUID

@Component
class RemoveConnectionUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: UUID, connectionId: UUID, username: String? = null): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        if (username != null) {
            val user = userPort.findByUsername(username)
                ?: throw NoSuchElementException("User $username not found")
            state.requireCollaborator(user.id)
        }
        require(state.connections.containsKey(connectionId)) {
            "Connection $connectionId not found"
        }
        state.connections.remove(connectionId)
        // Cascade: remove StageConnection entries referencing this connection
        state.processes.values.forEach { process ->
            process.stages.forEach { stage ->
                stage.connections.removeIf { it.connectionId == connectionId }
            }
        }
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
