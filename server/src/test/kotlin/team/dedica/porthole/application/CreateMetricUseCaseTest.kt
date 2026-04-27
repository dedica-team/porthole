package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.domain.*

class CreateMetricUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: CreateMetricUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "p1", username = "Alice"))
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }
        useCase = CreateMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `creates metric with valid name and description`() {
        val result = useCase.execute(state.id, "Alice", "Availability", "Uptime percentage")
        assertEquals(1, result.metrics.size)
        val metric = result.metrics.values.first()
        assertEquals("Availability", metric.name)
        assertEquals("Uptime percentage", metric.description)
        assertNotNull(metric.id)
    }

    @Test
    fun `metric id is a UUID`() {
        val result = useCase.execute(state.id, "Alice", "Latency", "Response time in ms")
        assertDoesNotThrow { java.util.UUID.fromString(result.metrics.values.first().id) }
    }

    @Test
    fun `trims whitespace from name and description`() {
        val result = useCase.execute(state.id, "Alice", "  Error Rate  ", "  Errors per second  ")
        val metric = result.metrics.values.first()
        assertEquals("Error Rate", metric.name)
        assertEquals("Errors per second", metric.description)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "   ", "desc")
        }
    }

    @Test
    fun `empty name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "", "desc")
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-such-map", "Alice", "Metric", "desc")
        }
    }

    @Test
    fun `multiple metrics can coexist`() {
        useCase.execute(state.id, "Alice", "Availability", "Uptime")
        val result = useCase.execute(state.id, "Alice", "Latency", "Response time")
        assertEquals(2, result.metrics.size)
    }
}
