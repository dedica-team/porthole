package team.dedica.porthole.application

import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.RemoveMetricUseCase
import team.dedica.porthole.application.session.metrics.SetLandmarkMetricUseCase
import team.dedica.porthole.domain.*

class RemoveMetricUseCaseTest {

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: RemoveMetricUseCase
    private lateinit var metricId: UUID
    private val keepId = UUID.nameUUIDFromBytes("keep-1".toByteArray())
    private val landmarkKey = keepId

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(collaborator)
        mapStatePort = InMemorySessionStatePort()
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)

        val createMetric = CreateMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        state = createMetric.execute(state.id, collaborator.id, "Availability", "Uptime", null)
        metricId = state.metrics.values.first().id

        val tile = HexCoordinate(0, 0)
        val landmark = Landmark(id = keepId, ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = tile)
        state.landmarks[keepId] = landmark
        mapStatePort.save(state)

        val setMetric = SetLandmarkMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        state = setMetric.execute(state.id, keepId, metricId, "99 %", QualityLevel.OK, callerId = collaborator.id)

        useCase = RemoveMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `removes metric from state`() {
        val result = useCase.execute(state.id, collaborator.id, metricId)
        assertFalse(result.metrics.containsKey(metricId))
    }

    @Test
    fun `removes metric and its transformations from state`() {
        val transformation = MetricTransformation(
            id = UUID.randomUUID(),
            name = "GitLab MRs Ingestion",
            metricId = metricId,
            requestUrl = "https://gitlab.example.com/api/graphql",
            httpMethod = "POST",
            parameters = mapOf("group_path" to "group/project"),
            authHeader = "PRIVATE-TOKEN: secret",
            requestBody = "{\"query\": \"...\"}",
            jqFilter = "[.data.group.projects.nodes[]]",
            matchBy = MatchStrategy.NAME,
        )
        val s = mapStatePort.findById(state.id)!!
        s.metrics[metricId] = s.metrics[metricId]!!.copy(transformations = listOf(transformation))
        mapStatePort.save(s)

        val result = useCase.execute(state.id, collaborator.id, metricId)

        assertFalse(result.metrics.containsKey(metricId))
        assertNull(result.metrics[metricId])
    }

    @Test
    fun `cascades removal to all landmark entries`() {
        val result = useCase.execute(state.id, collaborator.id, metricId)
        assertFalse(result.landmarks[landmarkKey]!!.metrics.containsKey(metricId))
    }

    @Test
    fun `unrelated landmark entries are untouched`() {
        val createMetric = CreateMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        state = createMetric.execute(state.id, collaborator.id, "Latency", "Response time", null)
        val otherMetricId = state.metrics.values.first { it.name == "Latency" }.id
        val setMetric = SetLandmarkMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        state = setMetric.execute(
            state.id,
            keepId,
            otherMetricId,
            "120 ms",
            QualityLevel.WARNING,
            callerId = collaborator.id
        )

        val result = useCase.execute(state.id, collaborator.id, metricId)
        assertTrue(result.landmarks[landmarkKey]!!.metrics.containsKey(otherMetricId))
    }

    @Test
    fun `unknown metric id fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, UUID.randomUUID())
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaborator.id, metricId)
        }
    }
}
