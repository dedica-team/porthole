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
        val result = createUC.execute(state.id, collaborator.id, "Availability", "Uptime percentage")
        metricId = result.metrics.values.first().id
        state = result
        useCase = EditMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `updates name`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, name = "Uptime", description = null)
        assertEquals("Uptime", result.metrics[metricId]!!.name)
        assertEquals("Uptime percentage", result.metrics[metricId]!!.description)
    }

    @Test
    fun `updates description`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, name = null, description = "New description")
        assertEquals("Availability", result.metrics[metricId]!!.name)
        assertEquals("New description", result.metrics[metricId]!!.description)
    }

    @Test
    fun `updates both name and description`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, "Reliability", "System reliability")
        assertEquals("Reliability", result.metrics[metricId]!!.name)
        assertEquals("System reliability", result.metrics[metricId]!!.description)
    }

    @Test
    fun `null values keep existing values`() {
        val result = useCase.execute(state.id, collaborator.id, metricId, null, null)
        assertEquals("Availability", result.metrics[metricId]!!.name)
        assertEquals("Uptime percentage", result.metrics[metricId]!!.description)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, metricId, "   ", null)
        }
    }

    @Test
    fun `unknown metric id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, collaborator.id, UUID.randomUUID(), "name", "desc")
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaborator.id, metricId, "name", null)
        }
    }
}
