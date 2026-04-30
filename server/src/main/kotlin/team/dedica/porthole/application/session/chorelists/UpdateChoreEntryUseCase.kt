package team.dedica.porthole.application.session.chorelists

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.ChoreEntryState
import team.dedica.porthole.domain.ChoreList

@Component
class UpdateChoreEntryUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(
        mapId: String,
        listId: String,
        landmarkId: String,
        state: ChoreEntryState?,
        assigneeId: String?,
        clearAssignee: Boolean,
        link: String?,
        clearLink: Boolean,
        note: String?,
        clearNote: Boolean,
        username: String,
    ): ChoreList {
        val mapState = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        mapState.requireCollaborator(user.id)
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
        mapStatePort.save(mapState)
        broadcastPort.send(mapId, mapState)
        return list
    }
}

