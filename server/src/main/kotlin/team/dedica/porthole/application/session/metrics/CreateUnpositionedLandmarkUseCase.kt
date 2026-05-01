package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.Landmark
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.MapState
import java.util.UUID

/**
 * Creates a new landmark without a map position (UUID id).
 */
@Component
class CreateUnpositionedLandmarkUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {

    fun execute(
        mapId: UUID,
        username: String,
        name: String,
        type: LandmarkType = LandmarkType.KEEP,
        description: String? = null,
        groupId: UUID? = null,
        link: String? = null,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        val collaboratorId = user.id
        state.requireCollaborator(collaboratorId)

        require(name.isNotBlank()) { "Landmark name must not be empty" }
        require(type != LandmarkType.WALL) { "Decorative landmarks (WALL) must be placed on a tile" }
        require(state.landmarks.values.none { it.name == name.trim() }) { "A landmark named '$name' already exists" }

        val id = UUID.randomUUID()

        val landmark = Landmark(
            id = id,
            name = name,
            ownerId = null,
            coordinate = null,
            type = type,
            description = description,
            groupId = groupId,
            link = link,
        )
        state.landmarks[id] = landmark

        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}