package team.dedica.porthole.application.session.metrics

import jakarta.inject.Singleton
import team.dedica.porthole.application.DataSanitationUtils.cleanAliases
import team.dedica.porthole.application.DataSanitationUtils.cleanLink
import team.dedica.porthole.application.DataSanitationUtils.cleanLinks
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Landmark
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

/**
 * Creates a new landmark without a map position (UUID id).
 */
@Singleton
class CreateUnpositionedLandmarkUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {

    fun execute(
        sessionId: UUID,
        callerId: UUID,
        name: String,
        type: LandmarkType = LandmarkType.KEEP,
        description: String? = null,
        groupId: UUID? = null,
        links: Map<String, String>? = null,
        link: String? = null,
        aliases: List<String>? = null,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)

        require(name.isNotBlank()) { "Landmark name must not be empty" }
        require(type != LandmarkType.WALL) { "Decorative landmarks (WALL) must be placed on a tile" }
        require(state.landmarks.values.none { it.name == name.trim() }) { "A landmark named '$name' already exists" }

        val id = UUID.randomUUID()
        val resolvedLinks = when {
            links != null -> cleanLinks(links)
            link != null -> {
                val cleaned = cleanLink(link)
                if (cleaned != null) mapOf("default" to cleaned) else emptyMap()
            }
            else -> emptyMap()
        }

        state.landmarks[id] = Landmark(
            id = id,
            name = name,
            ownerId = null,
            coordinate = null,
            type = type,
            description = description,
            groupId = groupId,
            links = resolvedLinks,
            aliases = aliases?.let { cleanAliases(it) } ?: emptyList(),
        )

        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}