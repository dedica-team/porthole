package team.dedica.porthole.application.session.chorelists

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.ChoreEntry
import team.dedica.porthole.domain.ChoreList

@Component
class EditChoreListUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, listId: String, title: String?, landmarkIds: List<String>?, link: String?, clearLink: Boolean, username: String): List<ChoreList> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val list = state.choreLists[listId]
            ?: throw NoSuchElementException("Chore list $listId not found")
        title?.trim()?.takeIf { it.isNotBlank() }?.let { list.title = it }
        when {
            clearLink -> list.link = null
            link != null -> list.link = link.trim().takeIf { it.isNotBlank() }
        }
        if (landmarkIds != null) {
            // Validate all landmarks exist
            landmarkIds.forEach { id ->
                require(state.landmarks.containsKey(id)) { "Landmark $id not found on map $mapId" }
            }
            // Remove entries for de-selected landmarks
            list.entries.keys.toList().filter { it !in landmarkIds }.forEach { list.entries.remove(it) }
            // Add entries for newly added landmarks (preserve existing state/assignee/link/note)
            landmarkIds.filter { it !in list.entries }.forEach { id ->
                list.entries[id] = ChoreEntry(landmarkId = id)
            }
        }
        mapStatePort.save(state)
        broadcastPort.sendChoreLists(mapId, state.choreLists)
        return state.choreLists.values.sortedBy { it.title }
    }
}

