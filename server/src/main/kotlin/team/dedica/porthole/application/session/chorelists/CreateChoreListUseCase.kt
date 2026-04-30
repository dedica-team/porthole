package team.dedica.porthole.application.session.chorelists

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.ChoreEntry
import team.dedica.porthole.domain.ChoreList

@Component
class CreateChoreListUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, title: String, landmarkIds: List<String>, link: String?, username: String): List<ChoreList> {
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
        broadcastPort.send(mapId, state)
        return state.choreLists.values.sortedBy { it.title }
    }
}

