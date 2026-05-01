package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.DataSanitationUtils.cleanLink
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.MapState
import java.util.UUID

@Component
class EditLandmarkUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(
        mapId: UUID,
        username: String,
        landmarkId: UUID,
        name: String?,
        type: LandmarkType?,
        description: String? = null,
        groupId: UUID? = null,
        clearGroup: Boolean = false,
        link: String? = null,
        clearLink: Boolean = false,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        val newName = if (name != null) {
            require(name.isNotBlank()) { "Landmark name must not be empty" }
            name.trim()
        } else {
            landmark.name
        }
        val newType = type ?: landmark.type
        val newDescription = if (description != null) description.trim().ifBlank { null } else landmark.description
        val newGroupId = when {
            clearGroup -> null
            groupId != null -> {
                require(state.groups.containsKey(groupId)) { "Group $groupId not found" }
                groupId
            }
            else -> landmark.groupId
        }
        val newLink = when {
            clearLink -> null
            link != null -> cleanLink(link)
            else -> landmark.link
        }
        state.landmarks[landmarkId] = landmark.copy(
            name = newName, type = newType, description = newDescription,
            groupId = newGroupId, link = newLink,
            metrics = landmark.metrics,
        )
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
