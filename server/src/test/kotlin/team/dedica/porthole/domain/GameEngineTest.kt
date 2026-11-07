package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.Random
import java.util.UUID

class GameEngineTest {

    private val now = Instant.parse("2026-01-01T00:00:00Z")

    private fun redLandmark(id: UUID, coordinate: HexCoordinate): Landmark =
        Landmark(
            id = id,
            name = "Red",
            coordinate = coordinate,
            type = LandmarkType.HOUSE,
            metrics = mapOf(
                UUID.randomUUID() to LandmarkMetricEntry(
                    metricId = UUID.randomUUID(),
                    level = QualityLevel.ERROR,
                ),
            ),
        )

    @Test
    fun `idle game does not tick`() {
        val state = SessionState(map = HexMap.createHexagonal(3), gameEnabled = true)
        assertFalse(GameEngine.tick(state, now))
        assertEquals(GamePhase.IDLE, state.gameState.phase)
    }

    @Test
    fun `starting arms the first wave`() {
        val state = SessionState(map = HexMap.createHexagonal(3), gameEnabled = true)
        state.gameState = GameEngine.start(state, now)

        assertEquals(GamePhase.INTERMISSION, state.gameState.phase)
        assertEquals(now.plusSeconds(GameEngine.FIRST_WAVE_DELAY_SECONDS), state.gameState.nextWaveAt)
    }

    @Test
    fun `starting seeds buildings with full health`() {
        val state = SessionState(map = HexMap.createHexagonal(3), gameEnabled = true)
        val keep = Landmark(
            id = UUID.randomUUID(),
            name = "Keep",
            coordinate = HexCoordinate(0, 0),
            type = LandmarkType.KEEP,
        )
        state.landmarks[keep.id] = keep

        state.gameState = GameEngine.start(state, now)

        assertEquals(100, state.gameState.buildingMaxHealth)
        assertEquals(100, state.gameState.buildingHealth[keep.id])
    }

    @Test
    fun `wave spawns bugs on red tiles`() {
        val state = SessionState(map = HexMap.createHexagonal(3), gameEnabled = true)
        val red = redLandmark(UUID.randomUUID(), HexCoordinate(0, 0))
        state.landmarks[red.id] = red
        state.gameState = GameState(
            phase = GamePhase.INTERMISSION,
            nextWaveAt = now.minusSeconds(1),
        )

        assertTrue(GameEngine.tick(state, now, Random(1)))

        assertEquals(GamePhase.ACTIVE, state.gameState.phase)
        assertEquals(1, state.gameState.wave)
        assertTrue(state.gameState.bugs.isNotEmpty())
        assertTrue(state.gameState.bugs.values.all { it.spawnCoordinate == HexCoordinate(0, 0) })
    }

    @Test
    fun `bugs move towards the nearest building`() {
        val state = SessionState(map = HexMap.createHexagonal(4), gameEnabled = true)
        val red = redLandmark(UUID.randomUUID(), HexCoordinate(0, 0))
        state.landmarks[red.id] = red
        val keep = Landmark(
            id = UUID.randomUUID(),
            name = "Keep",
            coordinate = HexCoordinate(3, 0),
            type = LandmarkType.KEEP,
        )
        state.landmarks[keep.id] = keep

        val bug = Bug(coordinate = HexCoordinate(0, 0), targetLandmarkId = null)
        state.gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(bug.id to bug))

        val before = state.gameState.bugs.getValue(bug.id).coordinate.distanceTo(HexCoordinate(3, 0))
        GameEngine.tick(state, now, Random(1))
        val moved = state.gameState.bugs.getValue(bug.id)
        val after = moved.coordinate.distanceTo(HexCoordinate(3, 0))

        assertTrue(after < before)
        assertEquals(bug.coordinate, moved.previousCoordinate)
    }

    @Test
    fun `adjacent bug attacks and reduces building health`() {
        val state = SessionState(map = HexMap.createHexagonal(4), gameEnabled = true)
        val target = Landmark(
            id = UUID.randomUUID(),
            name = "Keep",
            coordinate = HexCoordinate(1, 0),
            type = LandmarkType.KEEP,
        )
        state.landmarks[target.id] = target

        val bug = Bug(coordinate = HexCoordinate(0, 0))
        state.gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(bug.id to bug))

        GameEngine.tick(state, now, Random(1))

        assertEquals(GameEngine.BUILDING_HEALTH - 1, state.gameState.buildingHealth[target.id])
    }

    @Test
    fun `disabled game neither starts nor ticks`() {
        val state = SessionState(map = HexMap.createHexagonal(3), gameEnabled = false)
        state.gameState = GameState(
            phase = GamePhase.INTERMISSION,
            nextWaveAt = now.minusSeconds(1),
        )

        val fresh = SessionState(map = HexMap.createHexagonal(3), gameEnabled = false)
        assertEquals(GamePhase.IDLE, GameEngine.start(fresh, now).phase)
        assertFalse(GameEngine.tick(state, now, Random(1)))
        assertEquals(GamePhase.INTERMISSION, state.gameState.phase)
        assertTrue(state.gameState.bugs.isEmpty())
    }

    @Test
    fun `bug walks around walls instead of through them`() {
        val state = SessionState(map = HexMap.createHexagonal(4), gameEnabled = true)
        val keep = Landmark(
            id = UUID.randomUUID(),
            name = "Keep",
            coordinate = HexCoordinate(3, 0),
            type = LandmarkType.KEEP,
        )
        state.landmarks[keep.id] = keep
        val wallCoordinate = HexCoordinate(1, 0)
        val wall = Landmark(
            id = UUID.randomUUID(),
            name = "Wall",
            coordinate = wallCoordinate,
            type = LandmarkType.WALL,
        )
        state.landmarks[wall.id] = wall

        val bug = Bug(coordinate = HexCoordinate(0, 0))
        state.gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(bug.id to bug))

        GameEngine.tick(state, now, Random(1))

        val moved = state.gameState.bugs.getValue(bug.id)
        assertTrue(moved.coordinate != wallCoordinate)
        assertTrue(moved.coordinate != bug.coordinate)
    }

    @Test
    fun `destroyed building becomes ruins and scorches the ground`() {
        val state = SessionState(map = HexMap.createHexagonal(4), gameEnabled = true)
        val target = Landmark(
            id = UUID.randomUUID(),
            name = "Keep",
            coordinate = HexCoordinate(1, 0),
            type = LandmarkType.KEEP,
        )
        state.landmarks[target.id] = target
        val bug = Bug(coordinate = HexCoordinate(0, 0))
        state.gameState = GameState(
            phase = GamePhase.ACTIVE,
            bugs = mutableMapOf(bug.id to bug),
            buildingHealth = mutableMapOf(target.id to 1),
        )

        GameEngine.tick(state, now, Random(1))

        assertEquals(LandmarkType.RUINS, state.landmarks.getValue(target.id).type)
        assertEquals(0, state.gameState.buildingHealth[target.id])
        assertEquals(Terrain.SCORCHED, state.map.getTile(target.coordinate!!)?.terrain)
        assertEquals(Terrain.SCORCHED, state.map.getTile(HexCoordinate(0, 0))?.terrain)
    }

    @Test
    fun `clearing all bugs starts the intermission`() {
        val state = SessionState(map = HexMap.createHexagonal(3), gameEnabled = true)
        state.gameState = GameState(phase = GamePhase.ACTIVE)

        assertTrue(GameEngine.tick(state, now))
        assertEquals(GamePhase.INTERMISSION, state.gameState.phase)
        assertEquals(now.plusSeconds(GameEngine.WAVE_INTERMISSION_SECONDS), state.gameState.nextWaveAt)
    }
}
