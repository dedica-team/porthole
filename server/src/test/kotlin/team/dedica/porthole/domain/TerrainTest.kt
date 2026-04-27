package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class TerrainTest {

    @Test
    fun `all eleven terrain types exist`() {
        val values = Terrain.entries.map { it.name }
        assert(values.containsAll(listOf("WATER", "GRASS", "FOREST", "ROCKS", "MEADOW",
            "DESERT", "BEACH", "SWAMP", "SCORCHED", "SNOWY", "ICE")))
        assertEquals(11, values.size)
    }

    @Test
    fun `WATER terrain can be set on any elevation`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 5, terrain = Terrain.WATER)
        assertEquals(Terrain.WATER, tile.terrain)
        assertEquals(5, tile.elevation)
    }

    @Test
    fun `GRASS terrain can be set on elevation 0`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 0, terrain = Terrain.GRASS)
        assertEquals(Terrain.GRASS, tile.terrain)
        assertEquals(0, tile.elevation)
    }

    @Test
    fun `FOREST terrain can be set on elevation 0`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 0, terrain = Terrain.FOREST)
        assertEquals(Terrain.FOREST, tile.terrain)
    }

    @Test
    fun `ROCKS terrain can be set on elevation 1`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 1, terrain = Terrain.ROCKS)
        assertEquals(Terrain.ROCKS, tile.terrain)
    }

    @Test
    fun `MEADOW terrain can be set on any elevation`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 2, terrain = Terrain.MEADOW)
        assertEquals(Terrain.MEADOW, tile.terrain)
    }

    @Test
    fun `DESERT terrain can be set on any elevation`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 1, terrain = Terrain.DESERT)
        assertEquals(Terrain.DESERT, tile.terrain)
    }

    @Test
    fun `BEACH terrain can be set on any elevation`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 0, terrain = Terrain.BEACH)
        assertEquals(Terrain.BEACH, tile.terrain)
    }

    @Test
    fun `SWAMP terrain can be set on any elevation`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 1, terrain = Terrain.SWAMP)
        assertEquals(Terrain.SWAMP, tile.terrain)
    }

    @Test
    fun `SCORCHED terrain can be set on any elevation`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 3, terrain = Terrain.SCORCHED)
        assertEquals(Terrain.SCORCHED, tile.terrain)
    }

    @Test
    fun `SNOWY terrain can be set on any elevation`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 4, terrain = Terrain.SNOWY)
        assertEquals(Terrain.SNOWY, tile.terrain)
    }

    @Test
    fun `ICE terrain can be set on any elevation`() {
        val tile = HexTile(HexCoordinate(0, 0), elevation = 5, terrain = Terrain.ICE)
        assertEquals(Terrain.ICE, tile.terrain)
    }

    @Test
    fun `all terrain types are independent of elevation`() {
        Terrain.entries.forEach { terrain ->
            val low  = HexTile(HexCoordinate(0, 0), elevation = 0, terrain = terrain)
            val high = HexTile(HexCoordinate(0, 0), elevation = 5, terrain = terrain)
            assertEquals(terrain, low.terrain)
            assertEquals(terrain, high.terrain)
        }
    }
}
