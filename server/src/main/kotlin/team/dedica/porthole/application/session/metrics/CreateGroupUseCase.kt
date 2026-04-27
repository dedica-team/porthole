package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.DataSanitationUtils
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.LandmarkGroup
import team.dedica.porthole.domain.MapState
import java.util.NoSuchElementException
import java.util.UUID

@Component
class CreateGroupUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(
        mapId: String,
        username: String,
        name: String,
        color: String,
        description: String? = null,
        link: String? = null,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        require(name.isNotBlank()) { "Group name must not be empty" }
        require(DataSanitationUtils.HEX_COLOR_REGEX.matches(color)) { "Color must be a CSS hex string like #a1b2c3" }
        val validatedLink = link?.let { DataSanitationUtils.cleanLink(link) }
        val id = UUID.randomUUID().toString()
        state.groups[id] = LandmarkGroup(
            id = id,
            name = name.trim(),
            color = color,
            description = description?.trim()?.ifBlank { null },
            link = validatedLink,
        )
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}