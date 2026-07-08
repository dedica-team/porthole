package team.dedica.porthole.application.session.chorelists

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.ChoreEntry
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Component
class EditChoreListUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        listId: UUID,
        title: String?,
        landmarkIds: List<UUID>?,
        link: String?,
        clearLink: Boolean,
        description: String?,
        clearDescription: Boolean,
        callerId: UUID
    ): List<ChoreList> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val list = state.choreLists[listId]
            ?: throw NoSuchElementException("Chore list $listId not found")
        title?.trim()?.takeIf { it.isNotBlank() }?.let { list.title = it }
        when {
            clearLink -> list.link = null
            link != null -> list.link = link.trim().takeIf { it.isNotBlank() }
        }
        when {
            clearDescription -> list.description = null
            description != null -> list.description = description.trim().takeIf { it.isNotBlank() }
        }
        if (landmarkIds != null) {
            // Validate all landmarks exist
            landmarkIds.forEach { id ->
                require(state.landmarks.containsKey(id)) { "Landmark $id not found in session $sessionId" }
            }
            val landmarkKeys = landmarkIds.map { it }
            // Remove entries for de-selected landmarks
            list.entries.keys.toList().filter { it !in landmarkKeys }.forEach { list.entries.remove(it) }
            // Add entries for newly added landmarks (preserve existing state/assignee/link/note)
            landmarkIds.filter { it !in list.entries }.forEach { id ->
                list.entries[id] = ChoreEntry(landmarkId = id)
            }
        }
        sessionStatePort.save(state)
        broadcastPort.sendChoreLists(sessionId, state.choreLists)
        return state.choreLists.values.sortedBy { it.title }
    }
}
