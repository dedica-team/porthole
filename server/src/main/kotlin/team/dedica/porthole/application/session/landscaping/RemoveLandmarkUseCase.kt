package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.MapState

@Component
class RemoveLandmarkUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, username: String, landmarkId: String): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        val connectionIdsToRemove = state.connections.values
            .filter { it.originId == landmarkId || it.targetId == landmarkId }
            .map { it.id }
        connectionIdsToRemove.forEach { state.connections.remove(it) }
        // Cascade: remove StageConnection entries referencing any of the removed connections
        state.processes.values.forEach { process ->
            process.stages.forEach { stage ->
                stage.connections.removeIf { it.connectionId in connectionIdsToRemove }
            }
        }
        if (landmark.coordinate != null) state.map.setOwner(landmark.coordinate, null)
        state.landmarks.remove(landmarkId)
        // clean up collaborator matrix entries for the removed landmark
        state.collaboratorMatrix.entries.remove(landmarkId)
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}