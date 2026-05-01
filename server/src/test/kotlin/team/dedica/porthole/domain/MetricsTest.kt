package team.dedica.porthole.domain
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.NoOpBroadcastPort
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase

class MetricsTest {

    // ── MapState.metrics ──────────────────────────────────────────────────────

    @Test
    fun `metrics map is initialised to empty by default`() {
        val state = MapState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        assertNotNull(state.metrics)
        assertTrue(state.metrics.isEmpty())
    }

    @Test
    fun `metrics can be mutated on a MapState`() {
        val state = MapState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        val id = UUID.randomUUID()
        val metric = QualityMetric(id = id, name = "Availability", description = "Uptime")
        state.metrics[id] = metric
        assertEquals(metric, state.metrics[id])
        assertEquals(1, state.metrics.size)
    }

    @Test
    fun `metrics on already-populated state returns all entries`() {
        val state = MapState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
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

    // ── CreateMetricUseCase integration ───────────────────────────────────────

    @Test
    fun `CreateMetricUseCase adds a metric to the state`() {
        val state = MapState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")
        state.collaborators.add(collaborator)
        val port  = team.dedica.porthole.application.InMemoryMapStatePort()
        port.save(state)
        val userPort = team.dedica.porthole.application.InMemoryTestUserRepository().also {
            it.save(team.dedica.porthole.adapter.out.repository.UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
        }
        val uc = CreateMetricUseCase(
            port, userPort, NoOpBroadcastPort()
        )
        val result = uc.execute(state.id, "Alice", "Availability", "Uptime %")
        assertEquals(1, result.metrics.size)
        assertEquals("Availability", result.metrics.values.first().name)
    }
}
