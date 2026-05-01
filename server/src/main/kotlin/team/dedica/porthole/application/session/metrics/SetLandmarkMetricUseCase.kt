package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.DataSanitationUtils.cleanLink
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.LandmarkMetricEntry
import team.dedica.porthole.domain.MapState
import team.dedica.porthole.domain.QualityLevel
import java.net.URI
import java.util.UUID

@Component
class SetLandmarkMetricUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(
        mapId: UUID,
        landmarkId: UUID,
        metricId: UUID,
        value: String?,
        level: QualityLevel,
        link: String? = null,
        badges: Map<String, String> = emptyMap(),
        username: String? = null,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        if (username != null) {
            val user = userPort.findByUsername(username)
                ?: throw NoSuchElementException("User $username not found")
            state.requireCollaborator(user.id)
        }
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        require(state.metrics.containsKey(metricId)) { "Metric $metricId not found" }

        val trimmedValue = value?.trim()?.ifBlank { null }
        val validatedBadges = badges.entries.associate { (key, url) ->
            require(key.isNotBlank()) { "Badge key must not be blank" }
            val trimmed = url.trim()
            val uri = runCatching { URI(trimmed) }.getOrNull()
            require(uri != null && uri.scheme in listOf("http", "https") && uri.host != null) {
                "Badge '$key' must be a valid http/https URL"
            }
            key.trim() to trimmed
        }
        require(trimmedValue != null || validatedBadges.isNotEmpty()) {
            "Either a value or at least one badge URL must be provided"
        }

        val entry = LandmarkMetricEntry(
            metricId = metricId,
            value    = trimmedValue,
            link     = link?.let { cleanLink(it) },
            level    = level,
            badges   = validatedBadges,
        )
        state.landmarks[landmarkId] = landmark.copy(metrics = landmark.metrics + (metricId to entry))
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
