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

    @Test
    fun `bug wandering on map edge only steps onto valid on-map tiles`() {
        val map = HexMap.createHexagonal(2)
        val state = SessionState(map = map, gameEnabled = true)
        // Position on the edge of radius 2 hexagonal map
        val edgeCoord = HexCoordinate(2, 0)
        assertTrue(map.getTile(edgeCoord) != null)

        val bug = Bug(coordinate = edgeCoord)
        state.gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(bug.id to bug))

        // Tick several times to test random wandering along edge
        for (seed in 1..20) {
            val s = SessionState(map = map, gameEnabled = true)
            val b = Bug(coordinate = edgeCoord)
            s.gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(b.id to b))
            GameEngine.tick(s, now, Random(seed.toLong()))

            val stepped = s.gameState.bugs.getValue(b.id)
            assertTrue(map.getTile(stepped.coordinate) != null, "Bug moved off-map to ${stepped.coordinate}")
        }
    }

    @Test
    fun `bug on map edge stays in place when all valid neighbours are blocked`() {
        val map = HexMap.createHexagonal(1)
        val state = SessionState(map = map, gameEnabled = true)
        val edgeCoord = HexCoordinate(1, 0)

        // Block all valid on-map neighbours of edgeCoord with walls
        val onMapNeighbours = map.getNeighbours(edgeCoord).map { it.coordinate }
        onMapNeighbours.forEach { coord ->
            val wall = Landmark(
                id = UUID.randomUUID(),
                name = "Wall",
                coordinate = coord,
                type = LandmarkType.WALL,
            )
            state.landmarks[wall.id] = wall
        }

        val bug = Bug(coordinate = edgeCoord)
        state.gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(bug.id to bug))

        GameEngine.tick(state, now, Random(42))

        val moved = state.gameState.bugs.getValue(bug.id)
        assertEquals(edgeCoord, moved.coordinate, "Bug should stay in place when all on-map neighbours are blocked")
        assertEquals(null, moved.previousCoordinate)
    }

    @Test
    fun `off-map bug is pruned and cannot wander beyond map boundaries`() {
        val map = HexMap.createHexagonal(2)
        val state = SessionState(map = map, gameEnabled = true)
        val offMapCoord = HexCoordinate(10, 10)
        assertTrue(map.getTile(offMapCoord) == null)

        val bug = Bug(coordinate = offMapCoord)
        state.gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(bug.id to bug))

        GameEngine.tick(state, now, Random(1))

        assertFalse(state.gameState.bugs.containsKey(bug.id), "Off-map bug must be removed")
    }

    @Test
    fun `bugs do not target off-map landmarks`() {
        val map = HexMap.createHexagonal(2)
        val state = SessionState(map = map, gameEnabled = true)
        val offMapKeep = Landmark(
            id = UUID.randomUUID(),
            name = "OffMapKeep",
            coordinate = HexCoordinate(10, 10),
            type = LandmarkType.KEEP,
        )
        state.landmarks[offMapKeep.id] = offMapKeep

        val bug = Bug(coordinate = HexCoordinate(0, 0))
        state.gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(bug.id to bug))

        GameEngine.tick(state, now, Random(1))

        val stepped = state.gameState.bugs.getValue(bug.id)
        assertTrue(map.getTile(stepped.coordinate) != null)
        assertEquals(null, stepped.targetLandmarkId, "Bug should not target off-map landmark")
    }
}
