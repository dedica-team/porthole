package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.ConnectionType
import team.dedica.porthole.domain.MapState

@Component
class EditConnectionUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(
        mapId: String,
        connectionId: String,
        type: ConnectionType? = null,
        name: String? = null,
        description: String? = null,
        clearName: Boolean = false,
        clearDescription: Boolean = false,
        username: String? = null,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        if (username != null) {
            val user = userPort.findByUsername(username)
                ?: throw NoSuchElementException("User $username not found")
            state.requireCollaborator(user.id)
        }
        val existing = state.connections[connectionId]
            ?: throw NoSuchElementException("Connection $connectionId not found")

        val trimmedName = name?.trim()
        require(trimmedName == null || trimmedName.isNotBlank()) { "name must not be blank" }
        val trimmedDescription = description?.trim()
        require(trimmedDescription == null || trimmedDescription.isNotBlank()) { "description must not be blank" }

        val updated = existing.copy(
            type = type ?: existing.type,
            name = when {
                clearName -> null
                trimmedName != null -> trimmedName
                else -> existing.name
            },
            description = when {
                clearDescription -> null
                trimmedDescription != null -> trimmedDescription
                else -> existing.description
            },
        )
        state.connections[connectionId] = updated
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
