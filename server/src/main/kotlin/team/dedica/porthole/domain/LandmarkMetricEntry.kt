package team.dedica.porthole.domain

import java.util.UUID

/**
 * A concrete metric value assigned to a specific landmark.
 *
 * @param metricId  references [QualityMetric.id]
 * @param value     free-form display value, e.g. "99.9 %", "142 ms"; may be null when [link] or [badges] is present
 * @param link      optional URL for further details; may be present even when [value] is null
 * @param linkText  optional display label for [link]
 * @param level     quality classification for colour-coding
 * @param badges    named image badges (key → image URL) to display alongside the value
 */
data class LandmarkMetricEntry(
    val metricId: UUID,
    val value: String? = null,
    val link: String? = null,
    val linkText: String? = null,
    val level: QualityLevel = QualityLevel.NONE,
    val badges: Map<String, String> = emptyMap(),
)
