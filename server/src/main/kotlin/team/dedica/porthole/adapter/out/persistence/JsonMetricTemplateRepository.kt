package team.dedica.porthole.adapter.out.persistence

import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue
import jakarta.inject.Named
import jakarta.inject.Singleton
import team.dedica.porthole.application.port.GetMetricTemplatesPort
import team.dedica.porthole.domain.MetricTemplate

/**
 * Reads the pre-defined metric templates from the classpath resource
 * `metricTemplates.json` on every request.
 *
 * No in-memory snapshot is kept so that a recompile (e.g. during
 * mn:run) is immediately reflected without
 * a full server restart.
 */
@Singleton
class JsonMetricTemplateRepository(
    @param:Named("persistenceObjectMapper") private val objectMapper: ObjectMapper,
) : GetMetricTemplatesPort {

    override fun getTemplates(): List<MetricTemplate> {
        val resource = requireNotNull(javaClass.classLoader.getResourceAsStream("metricTemplates.json")) {
            "metricTemplates.json not found on classpath"
        }
        return resource.use { objectMapper.readValue(it) }
    }
}
