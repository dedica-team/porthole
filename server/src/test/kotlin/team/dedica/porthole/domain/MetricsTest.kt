package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.NoOpBroadcastPort
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase

/**
 * Tests for metrics behaviour on [MapState] and [Landmark].
 *
 * The former EclipseStore null-field workarounds (`safeMetrics()`, `safeGroups()`)
 * have been removed. Jackson always initialises fields to their default values,
 * so the metrics map is never null.
 */
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
        val metric = QualityMetric(id = "m1", name = "Availability", description = "Uptime")
        state.metrics["m1"] = metric
        assertEquals(metric, state.metrics["m1"])
        assertEquals(1, state.metrics.size)
    }

    @Test
    fun `metrics on already-populated state returns all entries`() {
        val state = MapState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        state.metrics["m1"] = QualityMetric(id = "m1", name = "Latency", description = "ms")
        state.metrics["m2"] = QualityMetric(id = "m2", name = "Errors", description = "err/s")
        assertEquals(2, state.metrics.size)
    }

    // ── Landmark.metrics ──────────────────────────────────────────────────────

    @Test
    fun `landmark metrics defaults to empty map`() {
        val lm = Landmark(id = "x", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        assertNotNull(lm.metrics)
        assertTrue(lm.metrics.isEmpty())
    }

    @Test
    fun `landmark metrics returns existing entries`() {
        val entry = LandmarkMetricEntry(metricId = "m1", value = "99 %", level = QualityLevel.OK)
        val lm = Landmark(
            id = "x", ownerId = "p1", coordinate = HexCoordinate(0, 0),
            metrics = mapOf("m1" to entry),
        )
        assertEquals(entry, lm.metrics["m1"])
    }

    @Test
    fun `landmark metrics can be updated via copy`() {
        val lm = Landmark(id = "x", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        val entry = LandmarkMetricEntry(metricId = "m1", value = "42 ms", level = QualityLevel.WARNING)
        val updated = lm.copy(metrics = lm.metrics + ("m1" to entry))
        assertEquals(entry, updated.metrics["m1"])
        assertTrue(lm.metrics.isEmpty(), "original landmark must be unchanged (immutable copy)")
    }

    // ── CreateMetricUseCase integration ───────────────────────────────────────

    @Test
    fun `CreateMetricUseCase adds a metric to the state`() {
        val state = MapState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        val collaborator = Collaborator(id = "p1", username = "Alice")
        state.collaborators.add(collaborator)
        val port  = team.dedica.porthole.application.InMemoryMapStatePort()
        port.save(state)
        val userPort = team.dedica.porthole.application.InMemoryTestUserRepository().also {
            it.save(team.dedica.porthole.adapter.out.repository.UserRecord("p1", "Alice", "gh-1"))
        }
        val uc = CreateMetricUseCase(
            port, userPort, NoOpBroadcastPort()
        )
        val result = uc.execute(state.id, "Alice", "Availability", "Uptime %")
        assertEquals(1, result.metrics.size)
        assertEquals("Availability", result.metrics.values.first().name)
    }
}
