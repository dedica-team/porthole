package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.EditMetricUseCase
import team.dedica.porthole.domain.*

class EditMetricUseCaseTest {
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: EditMetricUseCase
    private lateinit var metricId: UUID

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        mapStatePort = InMemorySessionStatePort()
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        val createUC = CreateMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        val result = createUC.execute(state.id, collaborator.id, "Availability", "Uptime percentage", null)
        metricId = result.metrics.values.first().id
        state = result
        useCase = EditMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `updates name`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, name = "Uptime", description = null, link = null, clearLink = false)
        assertEquals("Uptime", result.metrics[metricId]!!.name)
        assertEquals("Uptime percentage", result.metrics[metricId]!!.description)
    }

    @Test
    fun `updates description`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, name = null, description = "New description", link = null, clearLink = false)
        assertEquals("Availability", result.metrics[metricId]!!.name)
        assertEquals("New description", result.metrics[metricId]!!.description)
    }

    @Test
    fun `updates both name and description`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, "Reliability", "System reliability", null, false)
        assertEquals("Reliability", result.metrics[metricId]!!.name)
        assertEquals("System reliability", result.metrics[metricId]!!.description)
    }

    @Test
    fun `null values keep existing values`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, null, null, null, false)
        assertEquals("Availability", result.metrics[metricId]!!.name)
        assertEquals("Uptime percentage", result.metrics[metricId]!!.description)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, metricId, "   ", null, null, false)
        }
    }

    @Test
    fun `unknown metric id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, collaborator.id, UUID.randomUUID(), "name", "desc", null, false)
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaborator.id, metricId, "name", null, null, false)
        }
    }

    @Test
    fun `sets link`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, null, null, "https://example.com/dashboard", false)
        assertEquals("https://example.com/dashboard", result.metrics[metricId]!!.link)
    }

    @Test
    fun `trims whitespace from link`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, null, null, "  https://example.com  ", false)
        assertEquals("https://example.com", result.metrics[metricId]!!.link)
    }

    @Test
    fun `blank link is stored as null`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, null, null, "   ", false)
        assertNull(result.metrics[metricId]!!.link)
    }

    @Test
    fun `null link keeps existing link`() {
        useCase.execute(state.id, collaborator.id, metricId, null, null, "https://example.com", false)
        val result = useCase.execute(state.id, collaborator.id, metricId, null, null, null, false)
        assertEquals("https://example.com", result.metrics[metricId]!!.link)
    }

    @Test
    fun `clearLink removes existing link`() {
        useCase.execute(state.id, collaborator.id, metricId, null, null, "https://example.com", false)
        val result = useCase.execute(state.id, collaborator.id, metricId, null, null, null, clearLink = true)
        assertNull(result.metrics[metricId]!!.link)
    }
}
