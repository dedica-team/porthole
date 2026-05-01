package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.MapState
import java.util.UUID

@Component
class RemoveGroupUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: UUID, username: String, groupId: UUID): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        require(state.groups.containsKey(groupId)) { "Group $groupId not found" }
        state.groups.remove(groupId)
        // Clear groupId on all landmarks that referenced this group
        state.landmarks.replaceAll { _, landmark ->
            if (landmark.groupId == groupId) landmark.copy(groupId = null, metrics = landmark.metrics) else landmark
        }
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
