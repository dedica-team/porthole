package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.MapState

@Component
class RemoveConnectionUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, connectionId: String, username: String? = null): MapState {
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
