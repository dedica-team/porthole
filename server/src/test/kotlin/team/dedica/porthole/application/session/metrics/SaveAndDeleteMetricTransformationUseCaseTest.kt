package team.dedica.porthole.application.session.metrics

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.`in`.web.dto.MetricTransformationDto
import team.dedica.porthole.application.InMemoryAuthorizationPort
import team.dedica.porthole.application.InMemorySessionStatePort
import team.dedica.porthole.application.NoOpBroadcastPort
import team.dedica.porthole.domain.*
import java.util.UUID

class SaveAndDeleteMetricTransformationUseCaseTest {

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")
    private val metricId = UUID.randomUUID()

    private lateinit var state: SessionState
    private lateinit var sessionStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var saveUseCase: SaveMetricTransformationUseCase
    private lateinit var deleteUseCase: DeleteMetricTransformationUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(collaborator)

        val metric = QualityMetric(id = metricId, name = "Open MRs", description = "GitLab MRs")
        state.metrics[metricId] = metric

        sessionStatePort = InMemorySessionStatePort()
        sessionStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(sessionStatePort)
        saveUseCase = SaveMetricTransformationUseCase(sessionStatePort, NoOpBroadcastPort(), authorizationPort)
        deleteUseCase = DeleteMetricTransformationUseCase(sessionStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `save transformation adds new transformation`() {
        val transformationDto = MetricTransformationDto(
            name = "GitLab MRs Ingestion",
            requestUrl = "https://gitlab.example.com/api/v4/projects/12/merge_requests",
            httpMethod = "GET",
            jqFilter = "[.[] | {element: .title, value: .upvotes | tostring}]",
            matchBy = MatchStrategy.NAME,
            lastPayloadSample = "[{\"title\": \"Auth Service\", \"upvotes\": 3}]",
        )

        val updated = saveUseCase.execute(state.id, collaborator.id, metricId, transformationDto)
        val metric = updated.metrics[metricId]!!
        assertEquals(1, metric.transformations.size)
        val transformation = metric.transformations.first()
        assertEquals("GitLab MRs Ingestion", transformation.name)
        assertEquals("https://gitlab.example.com/api/v4/projects/12/merge_requests", transformation.requestUrl)
        assertEquals(MatchStrategy.NAME, transformation.matchBy)
    }

    @Test
    fun `save transformation updates existing transformation`() {
        val transformationId = UUID.randomUUID()
        val initialTransformation = MetricTransformation(
            id = transformationId,
            name = "Old Name",
            metricId = metricId,
            requestUrl = "https://old.url",
            jqFilter = ".",
        )
        val s = sessionStatePort.findById(state.id)!!
        s.metrics[metricId] = s.metrics[metricId]!!.copy(transformations = listOf(initialTransformation))
        sessionStatePort.save(s)

        val updatedDto = MetricTransformationDto(
            id = transformationId,
            name = "New Name",
            requestUrl = "https://new.url",
            httpMethod = "POST",
            jqFilter = ".items[]",
        )

        val updated = saveUseCase.execute(state.id, collaborator.id, metricId, updatedDto)
        val metric = updated.metrics[metricId]!!
        assertEquals(1, metric.transformations.size)
        assertEquals("New Name", metric.transformations.first().name)
        assertEquals("https://new.url", metric.transformations.first().requestUrl)
        assertEquals("POST", metric.transformations.first().httpMethod)
    }

    @Test
    fun `save transformation fails if another transformation has the same name`() {
        val transformation1 = MetricTransformation(
            id = UUID.randomUUID(),
            name = "GitLab MRs",
            metricId = metricId,
            requestUrl = "https://gitlab.url",
        )
        val transformation2 = MetricTransformation(
            id = UUID.randomUUID(),
            name = "GitHub PRs",
            metricId = metricId,
            requestUrl = "https://github.url",
        )
        val s = sessionStatePort.findById(state.id)!!
        s.metrics[metricId] = s.metrics[metricId]!!.copy(transformations = listOf(transformation1, transformation2))
        sessionStatePort.save(s)

        // Attempting to add a new transformation with existing name (case-insensitive) fails
        val duplicateNewDto = MetricTransformationDto(
            name = "gitlab mrs",
            requestUrl = "https://other.url",
        )
        val err1 = assertThrows(IllegalArgumentException::class.java) {
            saveUseCase.execute(state.id, collaborator.id, metricId, duplicateNewDto)
        }
        assertTrue(err1.message!!.contains("already exists"))

        // Attempting to rename transformation2 to transformation1's name fails
        val renameConflictDto = MetricTransformationDto(
            id = transformation2.id,
            name = "GitLab MRs",
            requestUrl = transformation2.requestUrl,
        )
        val err2 = assertThrows(IllegalArgumentException::class.java) {
            saveUseCase.execute(state.id, collaborator.id, metricId, renameConflictDto)
        }
        assertTrue(err2.message!!.contains("already exists"))
    }

    @Test
    fun `delete transformation removes transformation`() {
        val transformationId = UUID.randomUUID()
        val initialTransformation = MetricTransformation(
            id = transformationId,
            name = "Transformation To Delete",
            metricId = metricId,
            requestUrl = "https://old.url",
            jqFilter = ".",
        )
        val s = sessionStatePort.findById(state.id)!!
        s.metrics[metricId] = s.metrics[metricId]!!.copy(transformations = listOf(initialTransformation))
        sessionStatePort.save(s)

        val updated = deleteUseCase.execute(state.id, collaborator.id, metricId, transformationId)
        val metric = updated.metrics[metricId]!!
        assertTrue(metric.transformations.isEmpty())
    }
}
