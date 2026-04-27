package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.DataSanitationUtils.cleanLink
import team.dedica.porthole.application.DataSanitationUtils.HEX_COLOR_REGEX
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.MapState


@Component
class EditGroupUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(
        mapId: String,
        username: String,
        groupId: String,
        name: String?,
        color: String?,
        description: String? = null,
        clearDescription: Boolean = false,
        link: String? = null,
        clearLink: Boolean = false,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val group = state.groups[groupId]
            ?: throw NoSuchElementException("Group $groupId not found")
        if (name != null) require(name.isNotBlank()) { "Group name must not be empty" }
        if (color != null) require(HEX_COLOR_REGEX.matches(color)) { "Color must be a CSS hex string like #a1b2c3" }
        val newDescription = when {
            clearDescription -> null
            description != null -> description.trim().ifBlank { null }
            else -> group.description
        }
        val newLink = when {
            clearLink -> null
            link != null -> cleanLink(link)
            else -> group.link
        }
        state.groups[groupId] = group.copy(
            name = name?.trim() ?: group.name,
            color = color ?: group.color,
            description = newDescription,
            link = newLink,
        )
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
