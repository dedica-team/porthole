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
class CreateChoreListUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, title: String, landmarkIds: List<UUID>, link: String?, description: String?, callerId: UUID): List<ChoreList> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val trimmed = title.trim()
        require(trimmed.isNotBlank()) { "Chore list title must not be blank" }
        val list = ChoreList(
            title = trimmed,
            link = link?.trim()?.takeIf { it.isNotBlank() },
            description = description?.trim()?.takeIf { it.isNotBlank() },
        )
        landmarkIds.forEach { landmarkId ->
            require(state.landmarks.containsKey(landmarkId)) { "Landmark $landmarkId not found in session $sessionId" }
            list.entries[landmarkId] = ChoreEntry(landmarkId = landmarkId)
        }
        state.choreLists[list.id] = list
        sessionStatePort.save(state)
        broadcastPort.sendChoreLists(sessionId, state.choreLists)
        return state.choreLists.values.sortedBy { it.title }
    }
}
