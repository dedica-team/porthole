package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.MapState
import java.util.UUID

@Component
class EditCollaboratorMatrixUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: UUID, username: String, name: String): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        require(name.isNotBlank()) { "Matrix name must not be blank" }
        state.collaboratorMatrix = state.collaboratorMatrix.copy(name = name.trim())
        mapStatePort.save(state)
        broadcastPort.sendMatrix(mapId, state.collaboratorMatrix)
        return state
    }
}