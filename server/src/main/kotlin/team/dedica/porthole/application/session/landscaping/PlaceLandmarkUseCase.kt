package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.ConnectionRecalculator
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.Landmark
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.MapState
import java.util.UUID

/**
 * Places a new landmark for a user on a given hex coordinate.
 *
 * Rules:
 * - The target tile must exist.
 * - No landmark may already occupy the tile.
 */
@Component
class PlaceLandmarkUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {

    fun execute(
        mapId: String,
        username: String,
        coordinate: HexCoordinate,
        name: String,
        type: LandmarkType = LandmarkType.KEEP,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        val collaboratorId = user.id
        state.requireCollaborator(collaboratorId)

        require(name.isNotBlank()) { "Landmark name must not be empty" }
        val id = if (type == LandmarkType.WALL) UUID.randomUUID().toString() else toSlug(name)
        require(id.isNotEmpty()) { "Landmark name '$name' does not produce a valid ID" }
        require(state.landmarks[id] == null) { "Landmark ID '$id' is already taken" }

        state.map.getTile(coordinate)
            ?: error("Tile at $coordinate does not exist")
        require(state.getLandmarkAt(coordinate) == null) { "A landmark already exists at $coordinate" }

        state.map.setOwner(coordinate, collaboratorId)
        val landmark = Landmark(id = id, name = name, ownerId = null, coordinate = coordinate, type = type)
        state.landmarks[landmark.id] = landmark

        // Reroute any existing connections whose path now crosses the newly occupied tile.
        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordinate)

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

