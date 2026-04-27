package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Landmark
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.MapState

/**
 * Creates a new landmark without a map position.
 *
 * Rules:
 * - Name must not be blank.
 * - Type must not be decorative (WALL requires a UUID-based id and must be placed on a tile).
 * - Slug derived from name must be unique within the map.
 */
@Component
class CreateUnpositionedLandmarkUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {

    fun execute(
        mapId: String,
        username: String,
        name: String,
        type: LandmarkType = LandmarkType.KEEP,
        description: String? = null,
        groupId: String? = null,
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

        val id = toSlug(name)
        require(id.isNotEmpty()) { "Landmark name '$name' does not produce a valid ID" }
        require(state.landmarks[id] == null) { "Landmark ID '$id' is already taken" }

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
        state.landmarks[landmark.id] = landmark

        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }

    private fun toSlug(name: String): String =
        name.trim().lowercase()
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
            .replace(Regex("[^a-z0-9]+"), "-")
            .trimStart('-').trimEnd('-')
}