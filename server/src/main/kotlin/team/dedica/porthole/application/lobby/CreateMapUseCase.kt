package team.dedica.porthole.application.lobby

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.MapState

@Component
class CreateMapUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
) {
    fun execute(creatorUsername: String, mapType: String = "LAND", mapSize: String = "MEDIUM"): MapState {
        val user = userPort.findByUsername(creatorUsername)
            ?: throw NoSuchElementException("User $creatorUsername not found")
        val (cols, rows) = when (mapSize.uppercase()) {
            "SMALL" -> 25 to 25
            "LARGE" -> 80 to 80
            else    -> 50 to 50  // MEDIUM
        }
        val map = when (mapType.uppercase()) {
            "SEA"   -> HexMap.createSeaGrid(cols = cols, rows = rows)
            "BLANK" -> HexMap.createBlankGrid(cols = cols, rows = rows)
            else    -> HexMap.createGrid(cols = cols, rows = rows)
        }
        val state = MapState(map = map)
        state.collaborators.add(Collaborator(id = user.id, username = user.username, avatarUrl = user.avatarUrl))
        mapStatePort.save(state)
        return state
    }
}