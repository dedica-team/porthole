package team.dedica.porthole.application

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
    private lateinit var metricId: String
    private lateinit var landmarkId: String

    private val collaborator = Collaborator(id = "p1", username = "Alice")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(collaborator)
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }

        // Create metric
        val createMetric = CreateMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = createMetric.execute(state.id, "Alice", "Availability", "Uptime")
        metricId = state.metrics.values.first().id

        // Place a landmark and assign the metric
        val tile = HexCoordinate(0, 0)
        val landmark = Landmark(id = "keep-1", ownerId = "p1", coordinate = tile)
        state.landmarks["keep-1"] = landmark
        mapStatePort.save(state)
        landmarkId = "keep-1"

        // Assign metric to landmark
        val setMetric = SetLandmarkMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = setMetric.execute(state.id, landmarkId, metricId, "99 %", QualityLevel.OK)

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
        assertFalse(result.landmarks[landmarkId]!!.metrics.containsKey(metricId))
    }

    @Test
    fun `unrelated landmark entries are untouched`() {
        val createMetric = CreateMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = createMetric.execute(state.id, "Alice", "Latency", "Response time")
        val otherMetricId = state.metrics.values.first { it.name == "Latency" }.id
        val setMetric = SetLandmarkMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = setMetric.execute(state.id, landmarkId, otherMetricId, "120 ms", QualityLevel.WARNING)

        val result = useCase.execute(state.id, "Alice", metricId)
        // otherMetricId still present on landmark
        assertTrue(result.landmarks[landmarkId]!!.metrics.containsKey(otherMetricId))
    }

    @Test
    fun `unknown metric id fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "no-such-metric")
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-such-map", "Alice", metricId)
        }
    }
}
