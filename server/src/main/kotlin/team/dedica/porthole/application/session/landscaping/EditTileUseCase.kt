package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.MapState
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.Terrain
import java.util.UUID

@Component
class EditTileUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(
        mapId: UUID,
        username: String,
        coordinate: HexCoordinate,
        elevation: Int?,
        terrain: Terrain?,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)

        val existing = state.map.getTile(coordinate)
            ?: throw NoSuchElementException("Tile at $coordinate not found")

        if (elevation != null) {
            require(elevation in 0..5) { "Elevation must be between 0 and 5" }
        }

        val newElevation = elevation ?: existing.elevation
        val newTerrain = terrain ?: existing.terrain

        val updated = existing.copy(elevation = newElevation, terrain = newTerrain)
        state.map.setTile(coordinate, updated)

        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
