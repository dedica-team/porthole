package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.RemoveMetricUseCase
import team.dedica.porthole.application.session.metrics.SetLandmarkMetricUseCase
import team.dedica.porthole.domain.*

class RemoveMetricUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: RemoveMetricUseCase
    private lateinit var metricId: UUID
    private val keepId = UUID.nameUUIDFromBytes("keep-1".toByteArray())
    private val landmarkKey = keepId

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(collaborator)
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
        }

        val createMetric = CreateMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = createMetric.execute(state.id, "Alice", "Availability", "Uptime")
        metricId = state.metrics.values.first().id

        val tile = HexCoordinate(0, 0)
        val landmark = Landmark(id = keepId, ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = tile)
        state.landmarks[keepId] = landmark
        mapStatePort.save(state)

        val setMetric = SetLandmarkMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = setMetric.execute(state.id, keepId, metricId, "99 %", QualityLevel.OK)

        useCase = RemoveMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `removes metric from state`() {
        val result = useCase.execute(state.id, "Alice", metricId)
        assertFalse(result.metrics.containsKey(metricId))
    }

    @Test
    fun `cascades removal to all landmark entries`() {
        val result = useCase.execute(state.id, "Alice", metricId)
        assertFalse(result.landmarks[landmarkKey]!!.metrics.containsKey(metricId))
    }

    @Test
    fun `unrelated landmark entries are untouched`() {
        val createMetric = CreateMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = createMetric.execute(state.id, "Alice", "Latency", "Response time")
        val otherMetricId = state.metrics.values.first { it.name == "Latency" }.id
        val setMetric = SetLandmarkMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = setMetric.execute(state.id, keepId, otherMetricId, "120 ms", QualityLevel.WARNING)

        val result = useCase.execute(state.id, "Alice", metricId)
        assertTrue(result.landmarks[landmarkKey]!!.metrics.containsKey(otherMetricId))
    }

    @Test
    fun `unknown metric id fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", UUID.randomUUID())
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), "Alice", metricId)
        }
    }
}
