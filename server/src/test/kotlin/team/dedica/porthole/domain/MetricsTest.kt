package team.dedica.porthole.domain
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase

class MetricsTest {

    // ── MapState.metrics ──────────────────────────────────────────────────────

    @Test
    fun `metrics map is initialised to empty by default`() {
        val state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        assertNotNull(state.metrics)
        assertTrue(state.metrics.isEmpty())
    }

    @Test
    fun `metrics can be mutated on a MapState`() {
        val state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        val id = UUID.randomUUID()
        val metric = QualityMetric(id = id, name = "Availability", description = "Uptime")
        state.metrics[id] = metric
        assertEquals(metric, state.metrics[id])
        assertEquals(1, state.metrics.size)
    }

    @Test
    fun `metrics on already-populated state returns all entries`() {
        val state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        val id1 = UUID.randomUUID()
        val id2 = UUID.randomUUID()
        state.metrics[id1] = QualityMetric(id = id1, name = "Latency", description = "ms")
        state.metrics[id2] = QualityMetric(id = id2, name = "Errors", description = "err/s")
        assertEquals(2, state.metrics.size)
    }

    // ── Landmark.metrics ──────────────────────────────────────────────────────

    @Test
    fun `landmark metrics defaults to empty map`() {
        val lm = Landmark(id = UUID.nameUUIDFromBytes("x".toByteArray()), ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(0, 0))
        assertNotNull(lm.metrics)
        assertTrue(lm.metrics.isEmpty())
    }

    @Test
    fun `landmark metrics returns existing entries`() {
        val mId = UUID.randomUUID()
        val entry = LandmarkMetricEntry(metricId = mId, value = "99 %", level = QualityLevel.OK)
        val lm = Landmark(
            id = UUID.nameUUIDFromBytes("x".toByteArray()), ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(0, 0),
            metrics = mapOf(mId to entry),
        )
        assertEquals(entry, lm.metrics[mId])
    }

    @Test
    fun `landmark metrics can be updated via copy`() {
        val lm = Landmark(id = UUID.nameUUIDFromBytes("x".toByteArray()), ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(0, 0))
        val mId = UUID.randomUUID()
        val entry = LandmarkMetricEntry(metricId = mId, value = "42 ms", level = QualityLevel.WARNING)
        val updated = lm.copy(metrics = lm.metrics + (mId to entry))
        assertEquals(entry, updated.metrics[mId])
        assertTrue(lm.metrics.isEmpty(), "original landmark must be unchanged (immutable copy)")
    }

    @Test
    fun `landmark metrics may contain link only entries with link text`() {
        val mId = UUID.randomUUID()
        val entry = LandmarkMetricEntry(
            metricId = mId,
            link = "https://example.com/report",
            linkText = "Report",
            level = QualityLevel.NONE,
        )
        val lm = Landmark(
            id = UUID.nameUUIDFromBytes("x".toByteArray()), ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(0, 0),
            metrics = mapOf(mId to entry),
        )
        assertNull(lm.metrics[mId]!!.value)
        assertEquals("https://example.com/report", lm.metrics[mId]!!.link)
        assertEquals("Report", lm.metrics[mId]!!.linkText)
    }

    // ── CreateMetricUseCase integration ───────────────────────────────────────

    @Test
    fun `CreateMetricUseCase adds a metric to the state`() {
        val state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")
        state.collaborators.add(collaborator)
        val port = team.dedica.porthole.application.InMemorySessionStatePort()
        port.save(state)
        val authorizationPort = team.dedica.porthole.application.InMemoryAuthorizationPort(port)
        val uc = CreateMetricUseCase(
            port, team.dedica.porthole.application.NoOpBroadcastPort(), authorizationPort
        )
        val result = uc.execute(state.id, collaborator.id, "Availability", "Uptime %", null)
        assertEquals(1, result.metrics.size)
        assertEquals("Availability", result.metrics.values.first().name)
    }
}
