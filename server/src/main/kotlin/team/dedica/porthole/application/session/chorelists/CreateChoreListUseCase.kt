package team.dedica.porthole.application.session.chorelists

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.ChoreEntry
import team.dedica.porthole.domain.ChoreList
import java.util.UUID

@Component
class CreateChoreListUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: UUID, title: String, landmarkIds: List<UUID>, link: String?, username: String): List<ChoreList> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val trimmed = title.trim()
        require(trimmed.isNotBlank()) { "Chore list title must not be blank" }
        val list = ChoreList(title = trimmed, link = link?.trim()?.takeIf { it.isNotBlank() })
        landmarkIds.forEach { landmarkId ->
            require(state.landmarks.containsKey(landmarkId)) { "Landmark $landmarkId not found on map $mapId" }
            list.entries[landmarkId] = ChoreEntry(landmarkId = landmarkId)
        }
        state.choreLists[list.id] = list
        mapStatePort.save(state)
        broadcastPort.sendChoreLists(mapId, state.choreLists)
        return state.choreLists.values.sortedBy { it.title }
    }
}

