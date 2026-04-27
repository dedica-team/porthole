package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class HexMapTest {

    private lateinit var map: HexMap

    @BeforeEach
    fun setup() {
        map = HexMap.createHexagonal(radius = 3, elevationFn = { 3 })
    }

    @Test
    fun `hexagonal map with radius 3 has correct tile count`() {
        // formula: 3 * r^2 + 3 * r + 1
        assertEquals(37, map.size)
    }

    @Test
    fun `getTile returns tile for valid coordinate`() {
        assertNotNull(map.getTile(HexCoordinate(0, 0)))
    }

    @Test
    fun `getTile returns null for coordinate outside map`() {
        assertNull(map.getTile(HexCoordinate(99, 99)))
    }

    @Test
    fun `getNeighbours returns 6 neighbours for center tile`() {
        assertEquals(6, map.getNeighbours(HexCoordinate(0, 0)).size)
    }

    @Test
    fun `getNeighbours returns fewer neighbours for edge tile`() {
        // corner tile of radius-3 map has fewer than 6 in-map neighbours
        assertTrue(map.getNeighbours(HexCoordinate(3, 0)).size < 6)
    }

    @Test
    fun `setOwner assigns ownership to tile`() {
        map.setOwner(HexCoordinate(0, 0), "p1")
        assertEquals("p1", map.getTile(HexCoordinate(0, 0))?.ownerId)
    }

    @Test
    fun `setOwner with null clears ownership`() {
        map.setOwner(HexCoordinate(0, 0), "p1")
        map.setOwner(HexCoordinate(0, 0), null)
        assertNull(map.getTile(HexCoordinate(0, 0))?.ownerId)
    }

    @Test
    fun `setOwner on non-existing coordinate does nothing`() {
        assertDoesNotThrow { map.setOwner(HexCoordinate(99, 99), "p1") }
    }

    @Test
    fun `getTilesOwnedBy returns only tiles owned by that collaborator`() {
        map.setOwner(HexCoordinate(0, 0), "p1")
        map.setOwner(HexCoordinate(1, 0), "p1")
        map.setOwner(HexCoordinate(0, 1), "p2")
        assertEquals(2, map.getTilesOwnedBy("p1").size)
        assertEquals(1, map.getTilesOwnedBy("p2").size)
    }


    @Test
    fun `isAdjacent returns true for neighbouring tiles`() {
        assertTrue(map.isAdjacent(HexCoordinate(0, 0), HexCoordinate(1, 0)))
    }

    @Test
    fun `isAdjacent returns false for non-neighbouring tiles`() {
        assertFalse(map.isAdjacent(HexCoordinate(0, 0), HexCoordinate(2, 0)))
    }

    @Test
    fun `createHexagonal applies custom elevation function`() {
        val elevated = HexMap.createHexagonal(radius = 1, elevationFn = { 4 })
        elevated.allTiles.forEach { assertEquals(4, it.elevation) }
    }

    @Test
    fun `createHexagonal clamps elevation to valid range`() {
        val overElevated = HexMap.createHexagonal(radius = 1, elevationFn = { 99 })
        overElevated.allTiles.forEach { assertEquals(5, it.elevation) }
    }

    @Test
    fun `hexagonal map with radius 1 has correct tile count`() {
        val small = HexMap.createHexagonal(radius = 1, elevationFn = { 1 })
        assertEquals(7, small.size)
    }

    @Test
    fun `setTile replaces an existing tile`() {
        val coord = HexCoordinate(0, 0)
        val original = map.getTile(coord)!!
        val replacement = original.copy(elevation = 0, terrain = Terrain.WATER)
        map.setTile(coord, replacement)
        val updated = map.getTile(coord)!!
        assertEquals(0, updated.elevation)
        assertEquals(Terrain.WATER, updated.terrain)
    }

    @Test
    fun `setTile adds a tile for a new coordinate`() {
        val newCoord = HexCoordinate(99, 99)
        assertNull(map.getTile(newCoord))
        val newTile = HexTile(coordinate = newCoord, elevation = 2)
        map.setTile(newCoord, newTile)
        assertEquals(newTile, map.getTile(newCoord))
    }

    @Test
    fun `createGrid produces water tiles for low-elevation areas`() {
        val grid = HexMap.createGrid(cols = 20, rows = 20, seed = 1L)
        assertTrue(grid.allTiles.any { it.elevation == 0 }, "Expected at least one water tile")
    }

    @Test
    fun `createGrid produces non-water tiles`() {
        val grid = HexMap.createGrid(cols = 20, rows = 20, seed = 1L)
        assertTrue(grid.allTiles.any { it.elevation > 0 }, "Expected at least one non-water tile")
    }

    @Test
    fun `createGrid tile count equals cols times rows`() {
        val grid = HexMap.createGrid(cols = 10, rows = 8, seed = 42L)
        assertEquals(80, grid.size)
    }

    // ── createBlankGrid ───────────────────────────────────────────────────────

    @Test
    fun `createBlankGrid tile count equals cols times rows`() {
        val grid = HexMap.createBlankGrid(cols = 10, rows = 8)
        assertEquals(80, grid.size)
    }

    @Test
    fun `createBlankGrid all tiles are GRASS`() {
        val grid = HexMap.createBlankGrid(cols = 5, rows = 5)
        grid.allTiles.forEach { assertEquals(Terrain.GRASS, it.terrain) }
    }

    @Test
    fun `createBlankGrid all tiles have elevation 1`() {
        val grid = HexMap.createBlankGrid(cols = 5, rows = 5)
        grid.allTiles.forEach { assertEquals(1, it.elevation) }
    }

    @Test
    fun `createBlankGrid has no water tiles`() {
        val grid = HexMap.createBlankGrid(cols = 10, rows = 10)
        assertTrue(grid.allTiles.none { it.terrain == Terrain.WATER })
    }

    @Test
    fun `createBlankGrid small size has correct tile count`() {
        val grid = HexMap.createBlankGrid(cols = 25, rows = 25)
        assertEquals(625, grid.size)
    }

    @Test
    fun `createBlankGrid medium size has correct tile count`() {
        val grid = HexMap.createBlankGrid(cols = 50, rows = 50)
        assertEquals(2500, grid.size)
    }

    @Test
    fun `createBlankGrid large size has correct tile count`() {
        val grid = HexMap.createBlankGrid(cols = 80, rows = 80)
        assertEquals(6400, grid.size)
    }

    // ── createSeaGrid ─────────────────────────────────────────────────────────

    @Test
    fun `createSeaGrid tile count equals cols times rows`() {
        val grid = HexMap.createSeaGrid(cols = 10, rows = 10, seed = 1L)
        assertEquals(100, grid.size)
    }

    @Test
    fun `createSeaGrid has majority water tiles`() {
        val grid = HexMap.createSeaGrid(cols = 20, rows = 20, seed = 1L)
        val waterCount = grid.allTiles.count { it.terrain == Terrain.WATER }
        assertTrue(waterCount > grid.size / 2, "Sea map should be mostly water")
    }
}

