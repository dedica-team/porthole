package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.MapState
import java.util.UUID

@Component
class ChangeLandmarkOwnerUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    /** [newOwnerId] may be null to clear the owner. */
    fun execute(mapId: UUID, callerUsername: String, landmarkId: UUID, newOwnerId: UUID?): MapState {
        val caller = userPort.findByUsername(callerUsername)
            ?: throw NoSuchElementException("User $callerUsername not found")
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        state.requireCollaborator(caller.id)
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        if (newOwnerId != null) {
            require(state.isCollaborator(newOwnerId)) {
                "New owner $newOwnerId is not a collaborator on map $mapId"
            }
        }
        state.landmarks[landmarkId] = landmark.copy(ownerId = newOwnerId)
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
