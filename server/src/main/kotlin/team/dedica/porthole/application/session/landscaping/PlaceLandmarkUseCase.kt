package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
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
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {

    fun execute(
        mapId: UUID,
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

        state.map.getTile(coordinate)
            ?: error("Tile at $coordinate does not exist")
        require(state.getLandmarkAt(coordinate) == null) { "A landmark already exists at $coordinate" }

        val id = UUID.randomUUID()
        val landmark = Landmark(id = id, name = name, ownerId = null, coordinate = coordinate, type = type)
        state.landmarks[landmark.id] = landmark

        // Reroute any existing connections whose path now crosses the newly occupied tile.
        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordinate)

        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
