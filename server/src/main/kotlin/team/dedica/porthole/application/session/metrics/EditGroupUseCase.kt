package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.DataSanitationUtils.cleanLink
import team.dedica.porthole.application.DataSanitationUtils.HEX_COLOR_REGEX
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID


@Component
class EditGroupUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        callerId: UUID,
        groupId: UUID,
        name: String?,
        color: String?,
        description: String? = null,
        clearDescription: Boolean = false,
        link: String? = null,
        clearLink: Boolean = false,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
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
        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}
