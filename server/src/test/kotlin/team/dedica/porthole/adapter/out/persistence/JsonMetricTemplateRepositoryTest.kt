package team.dedica.porthole.adapter.out.persistence

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class JsonMetricTemplateRepositoryTest {

    private val config = JsonPersistenceConfig()
    private val mapper = config.persistenceObjectMapper()
    private val repository = JsonMetricTemplateRepository(mapper)

    @Test
    fun `getTemplates returns exactly 27 templates`() {
        assertEquals(27, repository.getTemplates().size)
    }

    @Test
    fun `every template has a non-blank id`() {
        repository.getTemplates().forEach { t ->
            assertTrue(t.id.isNotBlank(), "Template id must not be blank: $t")
        }
    }

    @Test
    fun `every template has a non-blank name`() {
        repository.getTemplates().forEach { t ->
            assertTrue(t.name.isNotBlank(), "Template name must not be blank: $t")
        }
    }

    @Test
    fun `every template has a non-blank description`() {
        repository.getTemplates().forEach { t ->
            assertTrue(t.description.isNotBlank(), "Template description must not be blank: $t")
        }
    }

    @Test
    fun `all template ids are unique`() {
        val ids = repository.getTemplates().map { it.id }
        assertEquals(ids.distinct().size, ids.size, "Duplicate template ids found")
    }

    @Test
    fun `codebase template is present with correct name`() {
        val codebase = repository.getTemplates().find { it.id == "codebase" }
        assertNotNull(codebase)
        assertEquals("Codebase", codebase!!.name)
    }

    @Test
    fun `all 12-factor and NFR template ids are present`() {
        val expectedIds = setOf(
            // 12-factor
            "codebase", "dependencies", "config", "backing-services",
            "build-release-run", "processes", "port-binding", "concurrency",
            "disposability", "dev-prod-parity", "logs", "admin-processes",
            // NFR
            "availability", "response-time", "throughput", "error-rate",
            "scalability", "recoverability", "mttr", "security",
            "observability", "api-stability", "data-consistency",
            "test-coverage", "deployment-frequency", "slo-compliance", "documentation",
        )
        val actualIds = repository.getTemplates().map { it.id }.toSet()
        assertEquals(expectedIds, actualIds)
    }

    @Test
    fun `getTemplates returns same list on subsequent calls`() {
        val first = repository.getTemplates()
        val second = repository.getTemplates()
        assertEquals(first, second)
    }
}
