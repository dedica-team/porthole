package team.dedica.porthole.application.session.collaboration

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.MapState

@Component
class SetCollaborationModeUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, username: String, mode: CollaborationMode): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val updated = state.copy(collaborationMode = mode)
        mapStatePort.save(updated)
        broadcastPort.send(mapId, updated)
        return updated
    }
}