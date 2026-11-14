package team.dedica.porthole.application.session.metrics

import jakarta.inject.Singleton
import team.dedica.porthole.adapter.`in`.web.dto.PushMetricValuesRequest
import team.dedica.porthole.adapter.`in`.web.dto.PushMetricValuesResponse
import team.dedica.porthole.application.DataSanitationUtils
import team.dedica.porthole.application.DataSanitationUtils.cleanLink
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Landmark
import team.dedica.porthole.domain.LandmarkMetricEntry
import team.dedica.porthole.domain.MatchStrategy
import team.dedica.porthole.domain.QualityMetric
import team.dedica.porthole.domain.SessionRole
import java.net.URI
import java.util.UUID

@Singleton
class PushMetricValuesUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {

    fun execute(
        sessionId: UUID,
        callerId: UUID,
        metricIdentifier: String,
        request: PushMetricValuesRequest,
    ): PushMetricValuesResponse {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)

        val trimmedIdentifier = metricIdentifier.trim()
        val metricIdFromUuid = runCatching { UUID.fromString(trimmedIdentifier) }.getOrNull()
        val metric: QualityMetric = (metricIdFromUuid?.let { state.metrics[it] }
            ?: state.metrics.values.firstOrNull { it.name.equals(trimmedIdentifier, ignoreCase = true) })
            ?: throw NoSuchElementException("Metric '$metricIdentifier' not found")

        var updatedCount = 0
        val unmatchedElements = mutableListOf<String>()
        val warnings = mutableListOf<String>()

        for (item in request.values) {
            val elementKey = item.element.trim()
            if (elementKey.isBlank()) continue

            val trimmedValue = item.value?.trim()?.ifBlank { null }
            val trimmedDescription = item.description?.trim()?.ifBlank { null }
            val cleanedLink = item.link?.let { cleanLink(it) }
            val cleanedLinkText = item.linkText?.trim()?.ifBlank { null }
            val validatedBadges = item.badges.entries.associate { (k, url) ->
                require(k.isNotBlank()) { "Badge key must not be blank" }
                val trimmed = url.trim()
                val uri = runCatching { URI(trimmed) }.getOrNull()
                require(uri != null && uri.scheme in listOf("http", "https") && uri.host != null) {
                    "Badge '$k' must be a valid http/https URL"
                }
                k.trim() to trimmed
            }

            require(cleanedLink != null || cleanedLinkText == null) {
                "Link text requires a link for element '$elementKey'"
            }
            require(trimmedValue != null || cleanedLink != null || validatedBadges.isNotEmpty()) {
                "Either a value, a link, or at least one badge URL must be provided for element '$elementKey'"
            }

            val matchingLandmarks: List<Landmark> = when (request.matchBy) {
                MatchStrategy.NAME -> {
                    state.landmarks.values.filter { it.name.trim().equals(elementKey, ignoreCase = true) }
                }
                MatchStrategy.LINK -> {
                    val canonicalTarget = DataSanitationUtils.normalizeCanonicalUrl(elementKey)
                    state.landmarks.values.filter { landmark ->
                        if (request.matchKey != null) {
                            val linkVal = landmark.links[request.matchKey]
                            linkVal != null && DataSanitationUtils.normalizeCanonicalUrl(linkVal) == canonicalTarget
                        } else {
                            landmark.links.values.any { linkVal ->
                                DataSanitationUtils.normalizeCanonicalUrl(linkVal) == canonicalTarget
                            }
                        }
                    }
                }
            }

            if (matchingLandmarks.isEmpty()) {
                unmatchedElements.add(item.element)
            } else {
                if (matchingLandmarks.size > 1) {
                    warnings.add("Multiple landmarks (${matchingLandmarks.size}) matched element '${item.element}'")
                }
                val entry = LandmarkMetricEntry(
                    metricId = metric.id,
                    value = trimmedValue,
                    description = trimmedDescription,
                    link = cleanedLink,
                    linkText = cleanedLinkText,
                    level = item.level,
                    badges = validatedBadges,
                )
                for (landmark in matchingLandmarks) {
                    state.landmarks[landmark.id] = landmark.copy(
                        metrics = landmark.metrics + (metric.id to entry)
                    )
                    updatedCount++
                }
            }
        }

        if (updatedCount > 0) {
            sessionStatePort.save(state)
            broadcastPort.send(sessionId, state)
        }

        return PushMetricValuesResponse(
            updatedCount = updatedCount,
            unmatchedElements = unmatchedElements,
            warnings = warnings,
        )
    }
}
