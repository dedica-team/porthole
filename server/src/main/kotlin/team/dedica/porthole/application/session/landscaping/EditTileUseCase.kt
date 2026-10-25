package team.dedica.porthole.application.session.landscaping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.Terrain
import java.util.UUID

@Singleton
class EditTileUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        callerId: UUID,
        coordinate: HexCoordinate,
        elevation: Int?,
        terrain: Terrain?,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val existing = state.map.getTile(coordinate)
            ?: throw NoSuchElementException("Tile at $coordinate not found")

        if (elevation != null) {
            require(elevation in 0..5) { "Elevation must be between 0 and 5" }
        }

        val updated = existing.copy(elevation = elevation ?: existing.elevation, terrain = terrain ?: existing.terrain)
        state.map.setTile(coordinate, updated)

        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}
