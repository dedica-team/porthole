package team.dedica.porthole.application.session.landscaping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.ConnectionRecalculator
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.Landmark
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

/**
 * Places a new landmark for a user on a given hex coordinate.
 *
 * Rules:
 * - The target tile must exist.
 * - No landmark may already occupy the tile.
 */
@Singleton
class PlaceLandmarkUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {

    fun execute(
        sessionId: UUID,
        callerId: UUID,
        coordinate: HexCoordinate,
        name: String,
        type: LandmarkType = LandmarkType.KEEP,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)

        require(name.isNotBlank()) { "Landmark name must not be empty" }

        state.map.getTile(coordinate)
            ?: error("Tile at $coordinate does not exist")
        require(state.getLandmarkAt(coordinate) == null) { "A landmark already exists at $coordinate" }

        val id = UUID.randomUUID()
        val landmark = Landmark(id = id, name = name, ownerId = null, coordinate = coordinate, type = type)
        state.landmarks[landmark.id] = landmark

        // Reroute any existing connections whose path now crosses the newly occupied tile.
        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordinate)

        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}
