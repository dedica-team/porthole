package team.dedica.porthole.application.lobby

import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Component
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.MapState

@Component
class AdminJoinMapUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
    private val adminService: AdminService,
) {
    fun execute(mapId: String, callerUsername: String): MapState {
        val user = userPort.findByUsername(callerUsername)
            ?: throw NoSuchElementException("User $callerUsername not found")
        if (!adminService.isAdmin(user.id)) {
            throw AccessDeniedException("Only admins can use admin-join")
        }
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        if (state.getCollaborator(user.id) == null) {
            state.collaborators.add(Collaborator(id = user.id, username = user.username, avatarUrl = user.avatarUrl))
            mapStatePort.save(state)
            broadcastPort.send(mapId, state)
        }
        return state
    }
}

