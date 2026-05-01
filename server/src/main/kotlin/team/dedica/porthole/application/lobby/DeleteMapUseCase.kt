package team.dedica.porthole.application.lobby

import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Component
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.application.port.MapStatePort
import java.util.UUID

@Component
class DeleteMapUseCase(
    private val mapStatePort: MapStatePort,
    private val adminService: AdminService,
) {
    fun execute(mapId: UUID, callerUserId: UUID) {
        if (!adminService.isAdmin(callerUserId)) {
            throw AccessDeniedException("Only admins can delete sessions")
        }
        mapStatePort.findById(mapId) ?: throw NoSuchElementException("Map $mapId not found")
        mapStatePort.delete(mapId)
    }
}

