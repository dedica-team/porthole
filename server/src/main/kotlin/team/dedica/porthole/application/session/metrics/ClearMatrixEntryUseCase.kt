package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.MapState

@Component
class ClearMatrixEntryUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, username: String, landmarkId: String, collaboratorId: String): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val byLandmark = state.collaboratorMatrix.entries[landmarkId]
        if (byLandmark != null) {
            byLandmark.remove(collaboratorId)
            if (byLandmark.isEmpty()) state.collaboratorMatrix.entries.remove(landmarkId)
            mapStatePort.save(state)
            broadcastPort.send(mapId, state)
        }
        return state
    }
}