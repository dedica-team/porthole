package team.dedica.porthole.domain

import java.util.UUID

/**
 * A map-wide quality metric definition.
 *
 * @param id          unique ID (UUID)
 * @param name        human-readable metric name (e.g. "Availability")
 * @param description what this metric measures
 * @param link        optional reference documentation URL
 * @param presets     reusable transformation presets for external integrations
 */
data class QualityMetric(
    val id: UUID,
    val name: String,
    val description: String,
    val link: String? = null,
    val presets: List<MetricTransformationPreset> = emptyList(),
)
