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
        val result = useCase.execute(state.id, collaborator.id, "Availability", "Uptime percentage")
        assertEquals(1, result.metrics.size)
        val metric = result.metrics.values.first()
        assertEquals("Availability", metric.name)
        assertEquals("Uptime percentage", metric.description)
        assertNotNull(metric.id)
    }

    @Test
    fun `metric id is a UUID`() {
        val result = useCase.execute(state.id, collaborator.id, "Latency", "Response time in ms")
        assertNotNull(result.metrics.values.first().id)
    }

    @Test
    fun `trims whitespace from name and description`() {
        val result = useCase.execute(state.id, collaborator.id, "  Error Rate  ", "  Errors per second  ")
        val metric = result.metrics.values.first()
        assertEquals("Error Rate", metric.name)
        assertEquals("Errors per second", metric.description)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, "   ", "desc")
        }
    }

    @Test
    fun `empty name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, "", "desc")
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaborator.id, "Metric", "desc")
        }
    }

    @Test
    fun `multiple metrics can coexist`() {
        useCase.execute(state.id, collaborator.id, "Availability", "Uptime")
        val result = useCase.execute(state.id, collaborator.id, "Latency", "Response time")
        assertEquals(2, result.metrics.size)
    }
}
