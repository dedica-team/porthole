package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.CollaboratorMatrix
import java.util.UUID

@Component
class GetCollaboratorMatrixUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
) {
    fun execute(mapId: UUID, username: String): CollaboratorMatrix {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        return state.collaboratorMatrix
    }
}

