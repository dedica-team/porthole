package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.ConnectionRecalculator
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
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
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {

    fun execute(
        sessionId: UUID,
        callerId: UUID,
        landmarkId: UUID,
        coordinate: HexCoordinate,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
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

        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}
