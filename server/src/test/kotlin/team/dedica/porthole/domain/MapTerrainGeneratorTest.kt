package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.util.UUID

class MapTerrainGeneratorTest {

    @Test
    fun `regenerateTerrain preserves map size and coordinates and enforces level 0 is water`() {
        val originalMap = HexMap.createBlankGrid(cols = 20, rows = 20)
        val result = MapTerrainGenerator.regenerateTerrain(originalMap, seed = 12345L)
        val regenerated = result.map

        assertEquals(originalMap.size, regenerated.size)
        originalMap.allTiles.forEach { orig ->
            val tile = regenerated.getTile(orig.coordinate)
            assertNotNull(tile, "Coordinate ${orig.coordinate} should exist in regenerated map")
            assertTrue(tile!!.elevation in 0..5, "Elevation should be between 0 and 5")
            assertNotNull(tile.terrain)

            // Strict invariant: level 0 is water, level > 0 is non-water
            if (tile.elevation == 0) {
                assertEquals(Terrain.WATER, tile.terrain, "Level 0 must be WATER at ${orig.coordinate}")
            } else {
                assertNotEquals(Terrain.WATER, tile.terrain, "Level ${tile.elevation} must not be WATER at ${orig.coordinate}")
            }
        }
    }

    @Test
    fun `regenerateTerrain allows resizing map grid with cols and rows`() {
        val originalMap = HexMap.createBlankGrid(cols = 20, rows = 20)
        val result = MapTerrainGenerator.regenerateTerrain(originalMap, seed = 12345L, cols = 35, rows = 35)
        val regenerated = result.map

        assertEquals(35 * 35, regenerated.size)
    }

    @Test
    fun `regenerateTerrain places landmarks in the same group scattered on their island and not directly adjacent`() {
        val map = HexMap.createGrid(cols = 40, rows = 40, seed = 42L)
        val group = LandmarkGroup(id = UUID.randomUUID(), name = "Alpha Team", color = "#ff0000")
        val lm1 = Landmark(
            id = UUID.randomUUID(),
            name = "Keep 1",
            coordinate = HexCoordinate(-15, -15),
            groupId = group.id,
        )
        val lm2 = Landmark(
            id = UUID.randomUUID(),
            name = "Keep 2",
            coordinate = HexCoordinate(15, 15),
            groupId = group.id,
        )
        val lm3 = Landmark(
            id = UUID.randomUUID(),
            name = "Keep 3",
            coordinate = null,
            groupId = group.id,
        )

        val result = MapTerrainGenerator.regenerateTerrain(
            map = map,
            landmarks = listOf(lm1, lm2, lm3),
            groups = listOf(group),
            seed = 99999L,
        )

        val updatedLm1 = result.updatedLandmarks[lm1.id]!!
        val updatedLm2 = result.updatedLandmarks[lm2.id]!!
        val updatedLm3 = result.updatedLandmarks[lm3.id]!!

        assertNotNull(updatedLm1.coordinate)
        assertNotNull(updatedLm2.coordinate)
        assertNotNull(updatedLm3.coordinate)

        // All coordinates must be distinct
        val coords = listOf(updatedLm1.coordinate!!, updatedLm2.coordinate!!, updatedLm3.coordinate!!)
        assertEquals(3, coords.toSet().size, "All landmarks must have distinct coordinates")

        // All landmarks must be on land
        for (coord in coords) {
            val tile = result.map.getTile(coord)
            assertNotNull(tile)
            assertTrue(tile!!.elevation >= 1, "Landmark tile must have elevation >= 1 (was ${tile.elevation})")
            assertNotEquals(Terrain.WATER, tile.terrain, "Landmark tile must not be on water")
        }

        // Landmarks in the same group must NOT be directly adjacent to each other (distance >= 2)
        assertTrue(updatedLm1.coordinate!!.distanceTo(updatedLm2.coordinate!!) >= 2, "Landmarks must not be directly adjacent")
        assertTrue(updatedLm1.coordinate!!.distanceTo(updatedLm3.coordinate!!) >= 2, "Landmarks must not be directly adjacent")
        assertTrue(updatedLm2.coordinate!!.distanceTo(updatedLm3.coordinate!!) >= 2, "Landmarks must not be directly adjacent")

        // Landmarks in the same group are on the same island (within reasonable island radius distance)
        assertTrue(updatedLm1.coordinate!!.distanceTo(updatedLm2.coordinate!!) <= 15)
        assertTrue(updatedLm1.coordinate!!.distanceTo(updatedLm3.coordinate!!) <= 15)
        assertTrue(updatedLm2.coordinate!!.distanceTo(updatedLm3.coordinate!!) <= 15)
    }

    @Test
    fun `different groups have separate islands`() {
        val map = HexMap.createGrid(cols = 40, rows = 40, seed = 42L)
        val groupA = LandmarkGroup(id = UUID.randomUUID(), name = "Faction A", color = "#0000ff")
        val groupB = LandmarkGroup(id = UUID.randomUUID(), name = "Faction B", color = "#ff0000")

        val lmA = Landmark(
            id = UUID.randomUUID(),
            name = "Base A",
            coordinate = HexCoordinate(-14, 0),
            groupId = groupA.id,
        )
        val lmB = Landmark(
            id = UUID.randomUUID(),
            name = "Base B",
            coordinate = HexCoordinate(14, 0),
            groupId = groupB.id,
        )

        val result = MapTerrainGenerator.regenerateTerrain(
            map = map,
            landmarks = listOf(lmA, lmB),
            groups = listOf(groupA, groupB),
            seed = 42L,
        )

        val updatedA = result.updatedLandmarks[lmA.id]!!
        val updatedB = result.updatedLandmarks[lmB.id]!!

        val tileA = result.map.getTile(updatedA.coordinate!!)!!
        val tileB = result.map.getTile(updatedB.coordinate!!)!!
        assertTrue(tileA.elevation >= 1, "Group A landmark must be on land")
        assertTrue(tileB.elevation >= 1, "Group B landmark must be on land")

        // Groups must be significantly separated on distinct islands
        assertTrue(updatedA.coordinate!!.distanceTo(updatedB.coordinate!!) >= 8, "Different groups must be on separate islands")
    }

    @Test
    fun `islands feature realistic heightmaps with elevation gradient`() {
        val map = HexMap.createGrid(cols = 30, rows = 30, seed = 42L)
        val group = LandmarkGroup(id = UUID.randomUUID(), name = "Islanders", color = "#00ff00")
        val lm = Landmark(
            id = UUID.randomUUID(),
            name = "Capital",
            coordinate = HexCoordinate(0, 0),
            groupId = group.id,
        )

        val result = MapTerrainGenerator.regenerateTerrain(
            map = map,
            landmarks = listOf(lm),
            groups = listOf(group),
            seed = 100L,
        )
        val regenerated = result.map

        val elevations = regenerated.allTiles.map { it.elevation }.toSet()
        // Should have a variety of elevations: water (0), beach/lowland (1), hills/mountains (2..5)
        assertTrue(elevations.contains(0), "Should contain water (0)")
        assertTrue(elevations.contains(1), "Should contain shore/beach (1)")
        assertTrue(elevations.any { it >= 2 }, "Should contain elevated interior terrain")

        val terrains = regenerated.allTiles.map { it.terrain }.toSet()
        assertTrue(terrains.contains(Terrain.WATER), "Should have water")
        assertTrue(terrains.contains(Terrain.BEACH) || terrains.contains(Terrain.GRASS), "Should have coastal/lowland terrain")
    }

    @Test
    fun `deterministic generation with same seed produces identical results`() {
        val map = HexMap.createGrid(cols = 20, rows = 20, seed = 42L)
        val group = LandmarkGroup(id = UUID.randomUUID(), name = "Group", color = "#000000")
        val lm = Landmark(id = UUID.randomUUID(), name = "Castle", coordinate = HexCoordinate(2, 2), groupId = group.id)

        val gen1 = MapTerrainGenerator.regenerateTerrain(map, listOf(lm), listOf(group), seed = 777L)
        val gen2 = MapTerrainGenerator.regenerateTerrain(map, listOf(lm), listOf(group), seed = 777L)

        map.allTiles.forEach { orig ->
            val t1 = gen1.map.getTile(orig.coordinate)!!
            val t2 = gen2.map.getTile(orig.coordinate)!!
            assertEquals(t1.elevation, t2.elevation, "Elevation should match for coordinate ${orig.coordinate}")
            assertEquals(t1.terrain, t2.terrain, "Terrain should match for coordinate ${orig.coordinate}")
        }
        assertEquals(gen1.updatedLandmarks[lm.id]?.coordinate, gen2.updatedLandmarks[lm.id]?.coordinate)
    }

    @Test
    fun `HexMap regenerateTerrain helper delegates properly`() {
        val map = HexMap.createBlankGrid(cols = 15, rows = 15)
        val group = LandmarkGroup(id = UUID.randomUUID(), name = "Group", color = "#112233")
        val lm = Landmark(id = UUID.randomUUID(), name = "Castle", coordinate = HexCoordinate(0, 0), groupId = group.id)

        val result = map.regenerateTerrain(listOf(lm), listOf(group), seed = 123L)
        assertEquals(map.size, result.size)
        assertTrue(result.allTiles.any { it.elevation >= 1 && it.terrain != Terrain.WATER })
    }

    @Test
    fun `all level 0 tiles are water across various random seeds`() {
        val seeds = listOf(1L, 42L, 1337L, 99999L, -84729184712L)
        for (seed in seeds) {
            val map = HexMap.createBlankGrid(cols = 25, rows = 25)
            val group = LandmarkGroup(id = UUID.randomUUID(), name = "Group", color = "#ff5500")
            val lm = Landmark(id = UUID.randomUUID(), name = "Base", coordinate = HexCoordinate(1, 1), groupId = group.id)

            val result = MapTerrainGenerator.regenerateTerrain(map, listOf(lm), listOf(group), seed = seed)
            result.map.allTiles.forEach { tile ->
                if (tile.elevation == 0) {
                    assertEquals(Terrain.WATER, tile.terrain, "Tile with elevation 0 must be WATER (seed=$seed, coord=${tile.coordinate})")
                } else {
                    assertNotEquals(Terrain.WATER, tile.terrain, "Tile with elevation > 0 must not be WATER (seed=$seed, coord=${tile.coordinate})")
                }
            }
        }
    }
}
