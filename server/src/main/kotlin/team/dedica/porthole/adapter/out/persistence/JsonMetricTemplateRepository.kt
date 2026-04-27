package team.dedica.porthole.adapter.out.persistence

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.GetMetricTemplatesUseCase
import team.dedica.porthole.domain.MetricTemplate

/**
 * Reads the pre-defined metric templates from the classpath resource
 * `metricTemplates.json` on every request.
 *
 * No in-memory snapshot is kept so that a recompile (e.g. during
 * spring-boot:run with devtools) is immediately reflected without
 * a full server restart.
 */
@Component
class JsonMetricTemplateRepository(
    private val objectMapper: ObjectMapper,
) : GetMetricTemplatesUseCase {

    override fun getTemplates(): List<MetricTemplate> =
        objectMapper.readValue(ClassPathResource("metricTemplates.json").inputStream)
}
