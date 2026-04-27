package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.EditMetricUseCase
import team.dedica.porthole.domain.*

class EditMetricUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: EditMetricUseCase
    private lateinit var metricId: String

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
        val createUC = CreateMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        val result = createUC.execute(state.id, "Alice", "Availability", "Uptime percentage")
        metricId = result.metrics.values.first().id
        state = result
        useCase = EditMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `updates name`() {
        val result = useCase.execute(state.id, "Alice", metricId, name = "Uptime", description = null)
        assertEquals("Uptime", result.metrics[metricId]!!.name)
        assertEquals("Uptime percentage", result.metrics[metricId]!!.description)
    }

    @Test
    fun `updates description`() {
        val result = useCase.execute(state.id, "Alice", metricId, name = null, description = "New description")
        assertEquals("Availability", result.metrics[metricId]!!.name)
        assertEquals("New description", result.metrics[metricId]!!.description)
    }

    @Test
    fun `updates both name and description`() {
        val result = useCase.execute(state.id, "Alice", metricId, "Reliability", "System reliability")
        assertEquals("Reliability", result.metrics[metricId]!!.name)
        assertEquals("System reliability", result.metrics[metricId]!!.description)
    }

    @Test
    fun `null values keep existing values`() {
        val result = useCase.execute(state.id, "Alice", metricId, null, null)
        assertEquals("Availability", result.metrics[metricId]!!.name)
        assertEquals("Uptime percentage", result.metrics[metricId]!!.description)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", metricId, "   ", null)
        }
    }

    @Test
    fun `unknown metric id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Alice", "no-such-metric", "name", "desc")
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-such-map", "Alice", metricId, "name", null)
        }
    }
}
