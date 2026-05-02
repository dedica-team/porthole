package team.dedica.porthole.application

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.persistence.JsonMetricTemplateRepository

class GetMetricTemplatesPortTest {

    private val objectMapper = ObjectMapper().registerKotlinModule()
    private val useCase = JsonMetricTemplateRepository(objectMapper)

    @Test
    fun `returns a non-empty list of metric templates`() {
        val templates = useCase.getTemplates()
        assertTrue(templates.isNotEmpty(), "Expected at least one metric template")
    }

    @Test
    fun `each template has a non-blank id`() {
        useCase.getTemplates().forEach { template ->
            assertTrue(template.id.isNotBlank(), "Template id must not be blank")
        }
    }

    @Test
    fun `each template has a non-blank name`() {
        useCase.getTemplates().forEach { template ->
            assertTrue(template.name.isNotBlank(), "Template name must not be blank")
        }
    }
}

