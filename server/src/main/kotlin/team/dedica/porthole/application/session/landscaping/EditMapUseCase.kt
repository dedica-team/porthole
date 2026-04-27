package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.MapState

@Component
class EditMapUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(
        mapId: String,
        username: String,
        name: String?,
        description: String?,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val newName = name?.trim()?.ifBlank { null }
        val newDescription = description?.trim()?.ifBlank { null }
        val updated = state.copy(name = newName, description = newDescription)
        mapStatePort.save(updated)
        broadcastPort.send(mapId, updated)
        return updated
    }
}

