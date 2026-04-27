package team.dedica.porthole.domain

/**
 * A pre-defined template for a quality metric.
 *
 * Templates are loaded from the classpath resource `metricTemplates.json`
 * and served via [GET /api/metric-templates].
 *
 * @param id          stable slug identifier (e.g. "codebase") – not a UUID
 * @param name        human-readable metric name
 * @param description what this metric measures
 */
data class MetricTemplate(
    val id: String,
    val name: String,
    val description: String,
)

