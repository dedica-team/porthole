package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.MapState

@Component
class ChangeLandmarkOwnerUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    /** [newOwnerId] may be null or blank to clear the owner. */
    fun execute(mapId: String, callerUsername: String, landmarkId: String, newOwnerId: String?): MapState {
        val caller = userPort.findByUsername(callerUsername)
            ?: throw NoSuchElementException("User $callerUsername not found")
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        state.requireCollaborator(caller.id)
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        val resolvedOwnerId = newOwnerId?.takeIf { it.isNotBlank() }
        if (resolvedOwnerId != null) {
            require(state.isCollaborator(resolvedOwnerId)) {
                "New owner $resolvedOwnerId is not a collaborator on map $mapId"
            }
        }
        state.landmarks[landmarkId] = landmark.copy(ownerId = resolvedOwnerId)
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
