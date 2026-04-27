package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.SetLandmarkMetricUseCase
import team.dedica.porthole.domain.*

class SetLandmarkMetricUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: SetLandmarkMetricUseCase
    private lateinit var metricId: String

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "p1", username = "Alice"))
        val landmark = Landmark(id = "keep-1", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        state.landmarks["keep-1"] = landmark
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }

        val createMetric = CreateMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        state = createMetric.execute(state.id, "Alice", "Availability", "Uptime")
        metricId = state.metrics.values.first().id

        useCase = SetLandmarkMetricUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `sets metric entry on landmark`() {
        val result = useCase.execute(state.id, "keep-1", metricId, "99.9 %", QualityLevel.OK)
        val entry = result.landmarks["keep-1"]!!.metrics[metricId]!!
        assertEquals("99.9 %", entry.value)
        assertEquals(QualityLevel.OK, entry.level)
        assertNull(entry.link)
    }

    @Test
    fun `sets metric entry with link`() {
        val result = useCase.execute(state.id, "keep-1", metricId, "99.9 %", QualityLevel.OK, "https://example.com")
        assertEquals("https://example.com", result.landmarks["keep-1"]!!.metrics[metricId]!!.link)
    }

    @Test
    fun `overwrites existing entry`() {
        useCase.execute(state.id, "keep-1", metricId, "99.9 %", QualityLevel.OK)
        val result = useCase.execute(state.id, "keep-1", metricId, "50.0 %", QualityLevel.ERROR)
        val entry = result.landmarks["keep-1"]!!.metrics[metricId]!!
        assertEquals("50.0 %", entry.value)
        assertEquals(QualityLevel.ERROR, entry.level)
    }

    @Test
    fun `all quality levels are accepted`() {
        for (level in QualityLevel.entries) {
            val result = useCase.execute(state.id, "keep-1", metricId, "val", level)
            assertEquals(level, result.landmarks["keep-1"]!!.metrics[metricId]!!.level)
        }
    }

    @Test
    fun `blank value without badges fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "keep-1", metricId, "   ", QualityLevel.OK)
        }
    }

    @Test
    fun `null value without badges fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "keep-1", metricId, null, QualityLevel.OK)
        }
    }

    @Test
    fun `blank value with badges succeeds and stores null value`() {
        val result = useCase.execute(
            state.id, "keep-1", metricId,
            value = "   ", level = QualityLevel.OK,
            badges = mapOf("build" to "https://img.shields.io/badge/build-passing-green"),
        )
        val entry = result.landmarks["keep-1"]!!.metrics[metricId]!!
        assertNull(entry.value)
        assertEquals("https://img.shields.io/badge/build-passing-green", entry.badges["build"])
    }

    @Test
    fun `multiple badges are all stored`() {
        val result = useCase.execute(
            state.id, "keep-1", metricId, "ok", QualityLevel.OK,
            badges = mapOf(
                "build"    to "https://img.shields.io/badge/build-passing-green",
                "coverage" to "https://img.shields.io/badge/coverage-80%25-yellow",
            ),
        )
        val entry = result.landmarks["keep-1"]!!.metrics[metricId]!!
        assertEquals(2, entry.badges.size)
        assertEquals("https://img.shields.io/badge/build-passing-green",  entry.badges["build"])
        assertEquals("https://img.shields.io/badge/coverage-80%25-yellow", entry.badges["coverage"])
    }

    @Test
    fun `invalid badge URL fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id, "keep-1", metricId, "ok", QualityLevel.OK,
                badges = mapOf("build" to "not-a-url"),
            )
        }
    }

    @Test
    fun `ftp badge URL fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id, "keep-1", metricId, "ok", QualityLevel.OK,
                badges = mapOf("build" to "ftp://example.com/badge"),
            )
        }
    }

    @Test
    fun `blank badge key fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id, "keep-1", metricId, "ok", QualityLevel.OK,
                badges = mapOf("   " to "https://img.shields.io/badge/build-ok-green"),
            )
        }
    }

    @Test
    fun `invalid link fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "keep-1", metricId, "99 %", QualityLevel.OK, "not-a-url")
        }
    }

    @Test
    fun `ftp link fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "keep-1", metricId, "99 %", QualityLevel.OK, "ftp://example.com/file")
        }
    }

    @Test
    fun `unknown landmark id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "no-such-landmark", metricId, "val", QualityLevel.OK)
        }
    }

    @Test
    fun `unknown metric id fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "keep-1", "no-such-metric", "val", QualityLevel.OK)
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-such-map", "keep-1", metricId, "val", QualityLevel.OK)
        }
    }
}
