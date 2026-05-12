package team.dedica.porthole.application

import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.SetLandmarkMetricUseCase
import team.dedica.porthole.domain.*

class SetLandmarkMetricUseCaseTest {
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: SetLandmarkMetricUseCase
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

        useCase = SetLandmarkMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `sets metric entry on landmark`() {
        val result = useCase.execute(state.id, keepId, metricId, "99.9 %", QualityLevel.OK, callerId = collaborator.id)
        val entry = result.landmarks[keepId]!!.metrics[metricId]!!
        assertEquals("99.9 %", entry.value)
        assertEquals(QualityLevel.OK, entry.level)
        assertNull(entry.link)
    }

    @Test
    fun `sets metric entry with link`() {
        val result = useCase.execute(state.id, keepId, metricId, "99.9 %", QualityLevel.OK, "https://example.com", callerId = collaborator.id)
        assertEquals("https://example.com", result.landmarks[keepId]!!.metrics[metricId]!!.link)
    }

    @Test
    fun `sets metric entry with link only`() {
        val result = useCase.execute(
            state.id,
            keepId,
            metricId,
            value = null,
            level = QualityLevel.NONE,
            link = "https://example.com/report",
            callerId = collaborator.id,
        )

        val entry = result.landmarks[keepId]!!.metrics[metricId]!!
        assertNull(entry.value)
        assertEquals(QualityLevel.NONE, entry.level)
        assertEquals("https://example.com/report", entry.link)
    }

    @Test
    fun `stores trimmed link text`() {
        val result = useCase.execute(
            state.id,
            keepId,
            metricId,
            value = null,
            level = QualityLevel.NONE,
            link = "https://example.com/report",
            linkText = " Report details ",
            callerId = collaborator.id,
        )

        val entry = result.landmarks[keepId]!!.metrics[metricId]!!
        assertEquals("https://example.com/report", entry.link)
        assertEquals("Report details", entry.linkText)
    }

    @Test
    fun `overwrites existing entry`() {
        useCase.execute(state.id, keepId, metricId, "99.9 %", QualityLevel.OK, callerId = collaborator.id)
        val result = useCase.execute(state.id, keepId, metricId, "50.0 %", QualityLevel.ERROR, callerId = collaborator.id)
        val entry = result.landmarks[keepId]!!.metrics[metricId]!!
        assertEquals("50.0 %", entry.value)
        assertEquals(QualityLevel.ERROR, entry.level)
    }

    @Test
    fun `all quality levels are accepted`() {
        for (level in QualityLevel.entries) {
            val result = useCase.execute(state.id, keepId, metricId, "val", level, callerId = collaborator.id)
            assertEquals(level, result.landmarks[keepId]!!.metrics[metricId]!!.level)
        }
    }

    @Test
    fun `blank value without badges fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, keepId, metricId, "   ", QualityLevel.OK, callerId = collaborator.id)
        }
    }

    @Test
    fun `null value without link or badges fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, keepId, metricId, null, QualityLevel.OK, callerId = collaborator.id)
        }
    }

    @Test
    fun `link text without link fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id,
                keepId,
                metricId,
                value = "99 %",
                level = QualityLevel.OK,
                linkText = "Report",
                callerId = collaborator.id,
            )
        }
    }

    @Test
    fun `blank value with badges succeeds and stores null value`() {
        val result = useCase.execute(
            state.id, keepId, metricId,
            value = "   ", level = QualityLevel.OK,
            badges = mapOf("build" to "https://img.shields.io/badge/build-passing-green"),
            callerId = collaborator.id,
        )
        val entry = result.landmarks[keepId]!!.metrics[metricId]!!
        assertNull(entry.value)
        assertEquals("https://img.shields.io/badge/build-passing-green", entry.badges["build"])
    }

    @Test
    fun `multiple badges are all stored`() {
        val result = useCase.execute(
            state.id, keepId, metricId, "ok", QualityLevel.OK,
            badges = mapOf(
                "build" to "https://img.shields.io/badge/build-passing-green",
                "coverage" to "https://img.shields.io/badge/coverage-80%25-yellow",
            ),
            callerId = collaborator.id,
        )
        val entry = result.landmarks[keepId]!!.metrics[metricId]!!
        assertEquals(2, entry.badges.size)
        assertEquals("https://img.shields.io/badge/build-passing-green", entry.badges["build"])
        assertEquals("https://img.shields.io/badge/coverage-80%25-yellow", entry.badges["coverage"])
    }

    @Test
    fun `invalid badge URL fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id, keepId, metricId, "ok", QualityLevel.OK,
                badges = mapOf("build" to "not-a-url"),
                callerId = collaborator.id,
            )
        }
    }

    @Test
    fun `ftp badge URL fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id, keepId, metricId, "ok", QualityLevel.OK,
                badges = mapOf("build" to "ftp://example.com/badge"),
                callerId = collaborator.id,
            )
        }
    }

    @Test
    fun `blank badge key fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id, keepId, metricId, "ok", QualityLevel.OK,
                badges = mapOf("   " to "https://img.shields.io/badge/build-ok-green"),
                callerId = collaborator.id,
            )
        }
    }

    @Test
    fun `invalid link fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, keepId, metricId, "99 %", QualityLevel.OK, "not-a-url", callerId = collaborator.id)
        }
    }

    @Test
    fun `ftp link fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, keepId, metricId, "99 %", QualityLevel.OK, "ftp://example.com/file", callerId = collaborator.id)
        }
    }

    @Test
    fun `unknown landmark id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), metricId, "val", QualityLevel.OK, callerId = collaborator.id)
        }
    }

    @Test
    fun `unknown metric id fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, keepId, UUID.randomUUID(), "val", QualityLevel.OK, callerId = collaborator.id)
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), keepId, metricId, "val", QualityLevel.OK, callerId = collaborator.id)
        }
    }
}
