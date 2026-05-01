package team.dedica.porthole.application.session.collaboration

import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Component
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.MapState
import java.util.UUID

@Component
class RemoveCollaboratorUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
    private val adminService: AdminService,
) {
    /**
     * Removes [collaboratorId] from the session.
     * Only an admin may do this. A collaborator cannot remove themselves via this
     * use case (that would be a "leave" action and is out of scope here).
     */
    fun execute(mapId: UUID, callerUsername: String, collaboratorId: UUID): MapState {
        val caller = userPort.findByUsername(callerUsername)
            ?: throw NoSuchElementException("User $callerUsername not found")
        if (!adminService.isAdmin(caller.id)) {
            throw AccessDeniedException("Only admins can remove collaborators from a session")
        }
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val removed = state.collaborators.removeIf { it.id == collaboratorId }
        if (!removed) throw NoSuchElementException("Collaborator $collaboratorId not found in map $mapId")
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}

