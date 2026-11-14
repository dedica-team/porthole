package team.dedica.porthole.application.session.metrics

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.`in`.web.dto.MetricTransformationPresetDto
import team.dedica.porthole.application.InMemoryAuthorizationPort
import team.dedica.porthole.application.InMemorySessionStatePort
import team.dedica.porthole.application.NoOpBroadcastPort
import team.dedica.porthole.domain.*
import java.util.UUID

class SaveAndDeleteMetricPresetUseCaseTest {

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")
    private val metricId = UUID.randomUUID()

    private lateinit var state: SessionState
    private lateinit var sessionStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var saveUseCase: SaveMetricPresetUseCase
    private lateinit var deleteUseCase: DeleteMetricPresetUseCase

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
        saveUseCase = SaveMetricPresetUseCase(sessionStatePort, NoOpBroadcastPort(), authorizationPort)
        deleteUseCase = DeleteMetricPresetUseCase(sessionStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `save preset adds new preset`() {
        val presetDto = MetricTransformationPresetDto(
            name = "GitLab MRs Ingestion",
            requestUrl = "https://gitlab.example.com/api/v4/projects/12/merge_requests",
            httpMethod = "GET",
            jqFilter = "[.[] | {element: .title, value: .upvotes | tostring}]",
            matchBy = MatchStrategy.NAME,
            lastPayloadSample = "[{\"title\": \"Auth Service\", \"upvotes\": 3}]",
        )

        val updated = saveUseCase.execute(state.id, collaborator.id, metricId, presetDto)
        val metric = updated.metrics[metricId]!!
        assertEquals(1, metric.presets.size)
        val preset = metric.presets.first()
        assertEquals("GitLab MRs Ingestion", preset.name)
        assertEquals("https://gitlab.example.com/api/v4/projects/12/merge_requests", preset.requestUrl)
        assertEquals(MatchStrategy.NAME, preset.matchBy)
    }

    @Test
    fun `save preset updates existing preset`() {
        val presetId = UUID.randomUUID()
        val initialPreset = MetricTransformationPreset(
            id = presetId,
            name = "Old Name",
            metricId = metricId,
            requestUrl = "https://old.url",
            jqFilter = ".",
        )
        val s = sessionStatePort.findById(state.id)!!
        s.metrics[metricId] = s.metrics[metricId]!!.copy(presets = listOf(initialPreset))
        sessionStatePort.save(s)

        val updatedDto = MetricTransformationPresetDto(
            id = presetId,
            name = "New Name",
            requestUrl = "https://new.url",
            httpMethod = "POST",
            jqFilter = ".items[]",
        )

        val updated = saveUseCase.execute(state.id, collaborator.id, metricId, updatedDto)
        val metric = updated.metrics[metricId]!!
        assertEquals(1, metric.presets.size)
        assertEquals("New Name", metric.presets.first().name)
        assertEquals("https://new.url", metric.presets.first().requestUrl)
        assertEquals("POST", metric.presets.first().httpMethod)
    }

    @Test
    fun `delete preset removes preset`() {
        val presetId = UUID.randomUUID()
        val initialPreset = MetricTransformationPreset(
            id = presetId,
            name = "Preset To Delete",
            metricId = metricId,
            requestUrl = "https://old.url",
            jqFilter = ".",
        )
        val s = sessionStatePort.findById(state.id)!!
        s.metrics[metricId] = s.metrics[metricId]!!.copy(presets = listOf(initialPreset))
        sessionStatePort.save(s)

        val updated = deleteUseCase.execute(state.id, collaborator.id, metricId, presetId)
        val metric = updated.metrics[metricId]!!
        assertTrue(metric.presets.isEmpty())
    }
}
