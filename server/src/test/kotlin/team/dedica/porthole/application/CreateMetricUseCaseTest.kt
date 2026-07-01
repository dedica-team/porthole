package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.domain.*

class CreateMetricUseCaseTest {
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: CreateMetricUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        mapStatePort = InMemorySessionStatePort()
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = CreateMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `creates metric with valid name and description`() {
        val result = useCase.execute(state.id, collaborator.id, "Availability", "Uptime percentage", null)
        assertEquals(1, result.metrics.size)
        val metric = result.metrics.values.first()
        assertEquals("Availability", metric.name)
        assertEquals("Uptime percentage", metric.description)
        assertNotNull(metric.id)
    }

    @Test
    fun `metric id is a UUID`() {
        val result = useCase.execute(state.id, collaborator.id, "Latency", "Response time in ms", null)
        assertNotNull(result.metrics.values.first().id)
    }

    @Test
    fun `trims whitespace from name and description`() {
        val result = useCase.execute(state.id, collaborator.id, "  Error Rate  ", "  Errors per second  ", null)
        val metric = result.metrics.values.first()
        assertEquals("Error Rate", metric.name)
        assertEquals("Errors per second", metric.description)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, "   ", "desc", null)
        }
    }

    @Test
    fun `empty name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, "", "desc", null)
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaborator.id, "Metric", "desc", null)
        }
    }

    @Test
    fun `multiple metrics can coexist`() {
        useCase.execute(state.id, collaborator.id, "Availability", "Uptime", null)
        val result = useCase.execute(state.id, collaborator.id, "Latency", "Response time", null)
        assertEquals(2, result.metrics.size)
    }

    @Test
    fun `creates metric with link`() {
        val result = useCase.execute(state.id, collaborator.id, "Availability", "Uptime", "https://example.com/dashboard")
        val metric = result.metrics.values.first()
        assertEquals("https://example.com/dashboard", metric.link)
    }

    @Test
    fun `trims whitespace from link`() {
        val result = useCase.execute(state.id, collaborator.id, "Availability", "Uptime", "  https://example.com  ")
        assertEquals("https://example.com", result.metrics.values.first().link)
    }

    @Test
    fun `blank link is stored as null`() {
        val result = useCase.execute(state.id, collaborator.id, "Availability", "Uptime", "   ")
        assertNull(result.metrics.values.first().link)
    }

    @Test
    fun `null link results in null link on metric`() {
        val result = useCase.execute(state.id, collaborator.id, "Availability", "Uptime", null)
        assertNull(result.metrics.values.first().link)
    }
}
