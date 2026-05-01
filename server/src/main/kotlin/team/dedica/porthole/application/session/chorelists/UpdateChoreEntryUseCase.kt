package team.dedica.porthole.application.session.chorelists

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.ChoreEntryState
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Component
class UpdateChoreEntryUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        mapId: UUID,
        listId: UUID,
        landmarkId: UUID,
        state: ChoreEntryState?,
        assigneeId: UUID?,
        clearAssignee: Boolean,
        link: String?,
        clearLink: Boolean,
        note: String?,
        clearNote: Boolean,
        callerId: UUID,
    ): ChoreList {
        val mapState = authorizationPort.accessSession(callerId, mapId, SessionRole.COLLABORATOR)
        val list = mapState.choreLists[listId]
            ?: throw NoSuchElementException("Chore list $listId not found")
        val entry = list.entries[landmarkId]
            ?: throw NoSuchElementException("Entry for landmark $landmarkId not found in chore list $listId")
        state?.let { entry.state = it }
        when {
            clearAssignee -> entry.assigneeId = null
            assigneeId != null -> {
                require(mapState.isCollaborator(assigneeId)) { "Assignee $assigneeId is not a collaborator on map $mapId" }
                entry.assigneeId = assigneeId
            }
        }
        when {
            clearLink -> entry.link = null
            link != null -> entry.link = link.trim().takeIf { it.isNotBlank() }
        }
        when {
            clearNote -> entry.note = null
            note != null -> entry.note = note.trim().takeIf { it.isNotBlank() }
        }
        sessionStatePort.save(mapState)
        broadcastPort.sendChoreLists(mapId, mapState.choreLists)
        return list
    }
}
