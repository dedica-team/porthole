package team.dedica.porthole.application

import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.metrics.ClearLandmarkMetricUseCase
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.SetLandmarkMetricUseCase
import team.dedica.porthole.domain.*

class ClearLandmarkMetricUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: ClearLandmarkMetricUseCase
    private lateinit var metricId: UUID
    private val keepId = UUID.nameUUIDFromBytes("keep-1".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        val landmark = Landmark(
            id = keepId,
            ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(0, 0)
        )
        state.landmarks[keepId] = landmark
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
        }

        val createMetric = CreateMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = createMetric.execute(state.id, "Alice", "Availability", "Uptime")
        metricId = state.metrics.values.first().id

        val setMetric = SetLandmarkMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = setMetric.execute(state.id, keepId, metricId, "99 %", QualityLevel.OK)

        useCase = ClearLandmarkMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `removes metric entry from landmark`() {
        assertTrue(state.landmarks[keepId]!!.metrics.containsKey(metricId))
        val result = useCase.execute(state.id, keepId, metricId)
        assertFalse(result.landmarks[keepId]!!.metrics.containsKey(metricId))
    }

    @Test
    fun `idempotent – no error when entry not present`() {
        useCase.execute(state.id, keepId, metricId)
        assertDoesNotThrow { useCase.execute(state.id, keepId, metricId) }
    }

    @Test
    fun `other metric entries on the same landmark are untouched`() {
        val createMetric = CreateMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = createMetric.execute(state.id, "Alice", "Latency", "Response time")
        val otherMetricId = state.metrics.values.first { it.name == "Latency" }.id
        val setMetric = SetLandmarkMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = setMetric.execute(state.id, keepId, otherMetricId, "120 ms", QualityLevel.WARNING)

        val result = useCase.execute(state.id, keepId, metricId)
        assertTrue(result.landmarks[keepId]!!.metrics.containsKey(otherMetricId))
    }

    @Test
    fun `unknown landmark id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), metricId)
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), keepId, metricId)
        }
    }
}
