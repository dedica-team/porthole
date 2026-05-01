package team.dedica.porthole.application

import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.metrics.ClearLandmarkMetricUseCase
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.SetLandmarkMetricUseCase
import team.dedica.porthole.domain.*

class ClearLandmarkMetricUseCaseTest {
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: ClearLandmarkMetricUseCase
    private lateinit var metricId: UUID
    private val keepId = UUID.nameUUIDFromBytes("keep-1".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        val landmark = Landmark(
            id = keepId,
            ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(0, 0)
        )
        state.landmarks[keepId] = landmark
        mapStatePort = InMemorySessionStatePort()
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)

        val createMetric = CreateMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        state = createMetric.execute(state.id, collaborator.id, "Availability", "Uptime")
        metricId = state.metrics.values.first().id

        val setMetric = SetLandmarkMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        state = setMetric.execute(state.id, keepId, metricId, "99 %", QualityLevel.OK, callerId = collaborator.id)

        useCase = ClearLandmarkMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `removes metric entry from landmark`() {
        assertTrue(state.landmarks[keepId]!!.metrics.containsKey(metricId))
        val result = useCase.execute(state.id, keepId, metricId, callerId = collaborator.id)
        assertFalse(result.landmarks[keepId]!!.metrics.containsKey(metricId))
    }

    @Test
    fun `idempotent – no error when entry not present`() {
        useCase.execute(state.id, keepId, metricId, callerId = collaborator.id)
        assertDoesNotThrow { useCase.execute(state.id, keepId, metricId, callerId = collaborator.id) }
    }

    @Test
    fun `other metric entries on the same landmark are untouched`() {
        val createMetric = CreateMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        state = createMetric.execute(state.id, collaborator.id, "Latency", "Response time")
        val otherMetricId = state.metrics.values.first { it.name == "Latency" }.id
        val setMetric = SetLandmarkMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        state = setMetric.execute(state.id, keepId, otherMetricId, "120 ms", QualityLevel.WARNING, callerId = collaborator.id)

        val result = useCase.execute(state.id, keepId, metricId, callerId = collaborator.id)
        assertTrue(result.landmarks[keepId]!!.metrics.containsKey(otherMetricId))
    }

    @Test
    fun `unknown landmark id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), metricId, callerId = collaborator.id)
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), keepId, metricId, callerId = collaborator.id)
        }
    }
}
