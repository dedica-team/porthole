package team.dedica.porthole.application.session.metrics

import jakarta.inject.Singleton
import team.dedica.porthole.adapter.`in`.web.dto.PushMetricValuesRequest
import team.dedica.porthole.adapter.`in`.web.dto.PushMetricValuesResponse
import team.dedica.porthole.application.DataSanitationUtils
import team.dedica.porthole.application.DataSanitationUtils.cleanLink
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.AccessDeniedException
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
        metricId: UUID,
        request: PushMetricValuesRequest,
        scopedSessionId: UUID? = null,
        scopedMetricId: UUID? = null,
        isPushToken: Boolean = false,
    ): PushMetricValuesResponse {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)

        val metric: QualityMetric = state.metrics[metricId]
            ?: throw NoSuchElementException("Metric '$metricId' not found")

        if (isPushToken) {
            if (scopedSessionId != null && scopedSessionId != sessionId) {
                throw AccessDeniedException("Push token is not scoped to session '$sessionId'")
            }
            if (scopedMetricId != null && scopedMetricId != metric.id) {
                throw AccessDeniedException("Push token is not scoped to metric '${metric.name}' (${metric.id})")
            }
        }

        val landmarksByLookupKey: Map<String, List<Landmark>> = when (request.matchBy) {
            MatchStrategy.NAME -> state.landmarks.values.groupBy { it.name.trim().lowercase() }
            MatchStrategy.ALIAS -> state.landmarks.values.flatMap { landmark ->
                landmark.aliases.map { it.trim().lowercase() to landmark }
            }.groupBy({ it.first }, { it.second })
            MatchStrategy.LINK -> {
                val matchKey = request.matchKey
                state.landmarks.values.flatMap { landmark ->
                    val linksToCheck = if (matchKey != null) {
                        landmark.links[matchKey]?.let { listOf(it) } ?: emptyList()
                    } else {
                        landmark.links.values
                    }
                    linksToCheck.mapNotNull { linkVal ->
                        runCatching { DataSanitationUtils.normalizeCanonicalUrl(linkVal) }.getOrNull()?.let { it to landmark }
                    }
                }.groupBy({ it.first }, { it.second })
            }
        }

        val stagedUpdates = mutableListOf<Pair<UUID, LandmarkMetricEntry>>()
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

            val lookupKey = if (request.matchBy == MatchStrategy.LINK) {
                DataSanitationUtils.normalizeCanonicalUrl(elementKey)
            } else {
                elementKey.lowercase()
            }

            val matchingLandmarks = landmarksByLookupKey[lookupKey] ?: emptyList()

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
                    stagedUpdates.add(landmark.id to entry)
                }
            }
        }

        if (stagedUpdates.isNotEmpty()) {
            for ((landmarkId, entry) in stagedUpdates) {
                val current = state.landmarks[landmarkId] ?: continue
                state.landmarks[landmarkId] = current.copy(
                    metrics = current.metrics + (metric.id to entry)
                )
            }
            sessionStatePort.save(state)
            broadcastPort.send(sessionId, state)
        }

        return PushMetricValuesResponse(
            updatedCount = stagedUpdates.size,
            unmatchedElements = unmatchedElements,
            warnings = warnings,
        )
    }
}
