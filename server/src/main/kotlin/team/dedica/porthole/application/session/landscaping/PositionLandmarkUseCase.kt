package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.ConnectionRecalculator
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.MapState
import java.util.UUID

/**
 * Assigns (or reassigns) a map position to an existing landmark.
 *
 * Rules:
 * - The landmark must exist.
 * - The target tile must exist on the map.
 * - No *other* landmark may already occupy the target tile.
 * - If the landmark was already positioned, its old tile ownership is cleared first.
 */
@Component
class PositionLandmarkUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {

    fun execute(
        mapId: UUID,
        username: String,
        landmarkId: UUID,
        coordinate: HexCoordinate,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)

        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")

        state.map.getTile(coordinate)
            ?: error("Tile at $coordinate does not exist")
        val occupant = state.getLandmarkAt(coordinate)
        require(occupant == null || occupant.id == landmarkId) { "A landmark already exists at $coordinate" }

        state.landmarks[landmarkId] = landmark.copy(coordinate = coordinate)

        // 1. Recalculate connections whose endpoint is this landmark (its position changed).
        ConnectionRecalculator.recalculateConnectionsInvolvingLandmark(state, landmarkId)

        // 2. Recalculate third-party connections whose path now crosses the newly occupied tile.
        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordinate)

        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
