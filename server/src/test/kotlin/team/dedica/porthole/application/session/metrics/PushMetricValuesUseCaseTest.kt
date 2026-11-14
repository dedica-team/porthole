package team.dedica.porthole.application.session.metrics

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.`in`.web.dto.MetricElementValueDto
import team.dedica.porthole.adapter.`in`.web.dto.PushMetricValuesRequest
import team.dedica.porthole.application.InMemoryAuthorizationPort
import team.dedica.porthole.application.InMemorySessionStatePort
import team.dedica.porthole.application.NoOpBroadcastPort
import team.dedica.porthole.domain.*
import java.util.UUID

class PushMetricValuesUseCaseTest {

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")
    private val outsider = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")

    private val metricId = UUID.randomUUID()
    private val lm1Id = UUID.randomUUID()
    private val lm2Id = UUID.randomUUID()

    private lateinit var state: SessionState
    private lateinit var sessionStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: PushMetricValuesUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(collaborator)

        val metric = QualityMetric(id = metricId, name = "Open Merge Requests", description = "Pending MRs")
        val lm1 = Landmark(
            id = lm1Id,
            name = "Auth Service",
            links = mapOf(
                "repository" to "https://gitlab.example.com/team/auth-service.git",
                "docs" to "https://docs.example.com/auth",
            ),
        )
        val lm2 = Landmark(
            id = lm2Id,
            name = "Billing Service",
            links = mapOf(
                "repository" to "https://gitlab.example.com/team/billing-service",
            ),
        )

        state.metrics[metricId] = metric
        state.landmarks[lm1Id] = lm1
        state.landmarks[lm2Id] = lm2

        sessionStatePort = InMemorySessionStatePort()
        sessionStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(sessionStatePort)
        useCase = PushMetricValuesUseCase(sessionStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `push by name updates matched landmark and returns updated count`() {
        val request = PushMetricValuesRequest(
            matchBy = MatchStrategy.NAME,
            values = listOf(
                MetricElementValueDto(
                    element = "auth service",
                    value = "5",
                    level = QualityLevel.WARNING,
                    description = "5 open MRs",
                    link = "https://gitlab.example.com/team/auth-service/-/merge_requests",
                    linkText = "View MRs",
                    badges = mapOf("coverage" to "https://img.shields.io/badge/coverage-85%25-green"),
                ),
                MetricElementValueDto(
                    element = "Unknown Service",
                    value = "1",
                ),
            ),
        )

        val response = useCase.execute(state.id, collaborator.id, "Open Merge Requests", request)

        assertEquals(1, response.updatedCount)
        assertEquals(listOf("Unknown Service"), response.unmatchedElements)
        assertTrue(response.warnings.isEmpty())

        val updatedState = sessionStatePort.findById(state.id)!!
        val updatedLm1 = updatedState.landmarks[lm1Id]!!
        val metricEntry = updatedLm1.metrics[metricId]
        assertNotNull(metricEntry)
        assertEquals("5", metricEntry?.value)
        assertEquals(QualityLevel.WARNING, metricEntry?.level)
        assertEquals("5 open MRs", metricEntry?.description)
        assertEquals("https://gitlab.example.com/team/auth-service/-/merge_requests", metricEntry?.link)
        assertEquals("View MRs", metricEntry?.linkText)
        assertEquals(mapOf("coverage" to "https://img.shields.io/badge/coverage-85%25-green"), metricEntry?.badges)
    }

    @Test
    fun `push by link with canonical URL normalization and matchKey`() {
        val request = PushMetricValuesRequest(
            matchBy = MatchStrategy.LINK,
            matchKey = "repository",
            values = listOf(
                MetricElementValueDto(
                    element = "git@gitlab.example.com:team/auth-service.git",
                    value = "2",
                    level = QualityLevel.OK,
                ),
                MetricElementValueDto(
                    element = "http://gitlab.example.com/team/billing-service/",
                    value = "12",
                    level = QualityLevel.ERROR,
                ),
            ),
        )

        val response = useCase.execute(state.id, collaborator.id, metricId.toString(), request)

        assertEquals(2, response.updatedCount)
        assertTrue(response.unmatchedElements.isEmpty())

        val updatedState = sessionStatePort.findById(state.id)!!
        assertEquals("2", updatedState.landmarks[lm1Id]?.metrics?.get(metricId)?.value)
        assertEquals("12", updatedState.landmarks[lm2Id]?.metrics?.get(metricId)?.value)
    }

    @Test
    fun `unmatched elements are collected without failing matching ones`() {
        val request = PushMetricValuesRequest(
            matchBy = MatchStrategy.NAME,
            values = listOf(
                MetricElementValueDto(element = "NonExistent 1", value = "10"),
                MetricElementValueDto(element = "NonExistent 2", value = "20"),
            ),
        )

        val response = useCase.execute(state.id, collaborator.id, "Open Merge Requests", request)

        assertEquals(0, response.updatedCount)
        assertEquals(listOf("NonExistent 1", "NonExistent 2"), response.unmatchedElements)
    }

    @Test
    fun `multiple landmarks matching same element adds warning`() {
        val duplicateLmId = UUID.randomUUID()
        val s = sessionStatePort.findById(state.id)!!
        s.landmarks[duplicateLmId] = Landmark(id = duplicateLmId, name = "Auth Service")
        sessionStatePort.save(s)

        val request = PushMetricValuesRequest(
            matchBy = MatchStrategy.NAME,
            values = listOf(MetricElementValueDto(element = "Auth Service", value = "42")),
        )

        val response = useCase.execute(state.id, collaborator.id, "Open Merge Requests", request)

        assertEquals(2, response.updatedCount)
        assertEquals(1, response.warnings.size)
        assertTrue(response.warnings.first().contains("Multiple landmarks (2)"))
    }

    @Test
    fun `non-collaborator is rejected with AccessDeniedException`() {
        val request = PushMetricValuesRequest(
            matchBy = MatchStrategy.NAME,
            values = listOf(MetricElementValueDto(element = "Auth Service", value = "1")),
        )

        assertThrows(AccessDeniedException::class.java) {
            useCase.execute(state.id, outsider.id, "Open Merge Requests", request)
        }
    }

    @Test
    fun `unknown metric name throws NoSuchElementException`() {
        val request = PushMetricValuesRequest(
            matchBy = MatchStrategy.NAME,
            values = listOf(MetricElementValueDto(element = "Auth Service", value = "1")),
        )

        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, collaborator.id, "Non Existing Metric", request)
        }
    }
}
