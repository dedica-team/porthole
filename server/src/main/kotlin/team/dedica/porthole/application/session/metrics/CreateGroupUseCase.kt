package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.DataSanitationUtils
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.LandmarkGroup
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.*

@Component
class CreateGroupUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        callerId: UUID,
        name: String,
        color: String,
        description: String? = null,
        link: String? = null,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        require(name.isNotBlank()) { "Group name must not be empty" }
        require(DataSanitationUtils.HEX_COLOR_REGEX.matches(color)) { "Color must be a CSS hex string like #a1b2c3" }
        val validatedLink = link?.let { DataSanitationUtils.cleanLink(link) }
        val id = UUID.randomUUID()
        state.groups[id] = LandmarkGroup(
            id = id,
            name = name.trim(),
            color = color,
            description = description?.trim()?.ifBlank { null },
            link = validatedLink,
        )
        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}