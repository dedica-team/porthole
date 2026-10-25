package team.dedica.porthole.application.lobby

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
class CreateMapUseCase(
    private val sessionStatePort: SessionStatePort,
    private val userPort: UserPort,
) {
    fun execute(creatorId: UUID, mapType: String = "LAND", mapSize: String = "MEDIUM"): SessionState {
        val user = userPort.findById(creatorId)
            ?: throw NoSuchElementException("User $creatorId not found")
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
        val state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = user.id, username = user.username, avatarUrl = user.avatarUrl))
        sessionStatePort.save(state)
        return state
    }
}