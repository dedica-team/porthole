package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class HexTileTest {


    @Test
    fun `valid elevation boundaries are accepted`() {
        assertDoesNotThrow { HexTile(HexCoordinate(0, 0), elevation = 0) }
        assertDoesNotThrow { HexTile(HexCoordinate(0, 0), elevation = 5) }
    }

    @Test
    fun `elevation below 0 throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            HexTile(HexCoordinate(0, 0), elevation = -1)
        }
    }

    @Test
    fun `elevation above 5 throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            HexTile(HexCoordinate(0, 0), elevation = 6)
        }
    }

    @Test
    fun `default terrain is GRASS regardless of elevation`() {
        assertEquals(Terrain.GRASS, HexTile(HexCoordinate(0, 0), elevation = 0).terrain)
        assertEquals(Terrain.GRASS, HexTile(HexCoordinate(0, 0), elevation = 3).terrain)
        assertEquals(Terrain.GRASS, HexTile(HexCoordinate(0, 0), elevation = 5).terrain)
    }

    @Test
    fun `explicit terrain is independent of elevation`() {
        assertEquals(Terrain.WATER,  HexTile(HexCoordinate(0, 0), elevation = 5, terrain = Terrain.WATER).terrain)
        assertEquals(Terrain.FOREST, HexTile(HexCoordinate(0, 0), elevation = 0, terrain = Terrain.FOREST).terrain)
        assertEquals(Terrain.ROCKS,  HexTile(HexCoordinate(0, 0), elevation = 1, terrain = Terrain.ROCKS).terrain)
    }
}
