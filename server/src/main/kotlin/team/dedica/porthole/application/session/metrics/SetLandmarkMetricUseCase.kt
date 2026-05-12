package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.DataSanitationUtils.cleanLink
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.LandmarkMetricEntry
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.QualityLevel
import java.net.URI
import java.util.UUID

@Component
class SetLandmarkMetricUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        landmarkId: UUID,
        metricId: UUID,
        value: String?,
        level: QualityLevel,
        link: String? = null,
        linkText: String? = null,
        badges: Map<String, String> = emptyMap(),
        callerId: UUID,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        require(state.metrics.containsKey(metricId)) { "Metric $metricId not found" }

        val trimmedValue = value?.trim()?.ifBlank { null }
        val cleanedLink = link?.let { cleanLink(it) }
        val cleanedLinkText = linkText?.trim()?.ifBlank { null }
        val validatedBadges = badges.entries.associate { (key, url) ->
            require(key.isNotBlank()) { "Badge key must not be blank" }
            val trimmed = url.trim()
            val uri = runCatching { URI(trimmed) }.getOrNull()
            require(uri != null && uri.scheme in listOf("http", "https") && uri.host != null) {
                "Badge '$key' must be a valid http/https URL"
            }
            key.trim() to trimmed
        }
        require(cleanedLink != null || cleanedLinkText == null) {
            "Link text requires a link"
        }
        require(trimmedValue != null || cleanedLink != null || validatedBadges.isNotEmpty()) {
            "Either a value, a link, or at least one badge URL must be provided"
        }

        val entry = LandmarkMetricEntry(
            metricId = metricId,
            value    = trimmedValue,
            link     = cleanedLink,
            linkText = cleanedLinkText,
            level    = level,
            badges   = validatedBadges,
        )
        state.landmarks[landmarkId] = landmark.copy(metrics = landmark.metrics + (metricId to entry))
        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}
