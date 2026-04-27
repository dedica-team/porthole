package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class AStarPathfinderTest {

    private lateinit var map: HexMap

    @BeforeEach
    fun setup() {
        // radius-3 hexagonal map, all tiles walkable (elevation 3)
        map = HexMap.createHexagonal(radius = 3, elevationFn = { 3 })
    }

    @Test
    fun `finds path between two adjacent tiles`() {
        val path = AStarPathfinder.findPath(map, HexCoordinate(0, 0), HexCoordinate(1, 0))
        assertNotNull(path)
        assertEquals(HexCoordinate(0, 0), path!!.first())
        assertEquals(HexCoordinate(1, 0), path.last())
    }

    @Test
    fun `start equals goal returns single-element path`() {
        val path = AStarPathfinder.findPath(map, HexCoordinate(0, 0), HexCoordinate(0, 0))
        assertNotNull(path)
        assertEquals(listOf(HexCoordinate(0, 0)), path)
    }

    @Test
    fun `path is shortest on open map`() {
        val from = HexCoordinate(0, 0)
        val to = HexCoordinate(3, 0)
        val path = AStarPathfinder.findPath(map, from, to)
        assertNotNull(path)
        // shortest hex distance is 3, so path has 4 nodes
        assertEquals(4, path!!.size)
    }

    @Test
    fun `returns null when start tile does not exist`() {
        assertNull(AStarPathfinder.findPath(map, HexCoordinate(99, 99), HexCoordinate(0, 0)))
    }

    @Test
    fun `returns null when goal tile does not exist`() {
        assertNull(AStarPathfinder.findPath(map, HexCoordinate(0, 0), HexCoordinate(99, 99)))
    }

    @Test
    fun `path avoids water tiles`() {
        // Build a small map where q=1 column is all water, except one gap
        val tiles = mutableListOf<HexTile>()
        for (q in 0..3) {
            for (r in -2..2) {
                val elev = if (q == 1 && r != 0) 0 else 3  // water barrier with gap at r=0
                tiles += HexTile(HexCoordinate(q, r), elevation = elev)
            }
        }
        val barrierMap = HexMap(tiles)
        val path = AStarPathfinder.findPath(barrierMap, HexCoordinate(0, 0), HexCoordinate(2, 0))
        assertNotNull(path)
        // path must pass through the gap at (1, 0)
        assertTrue(path!!.contains(HexCoordinate(1, 0)))
    }

    @Test
    fun `path passes through complete water barrier`() {
        val tiles = mutableListOf<HexTile>()
        for (q in 0..3) {
            for (r in -2..2) {
                val elev = if (q == 1) 0 else 3  // solid water wall at q=1, now traversable
                tiles += HexTile(HexCoordinate(q, r), elevation = elev)
            }
        }
        val barrierMap = HexMap(tiles)
        assertNotNull(AStarPathfinder.findPath(barrierMap, HexCoordinate(0, 0), HexCoordinate(2, 0)))
    }

    @Test
    fun `path starts at from and ends at to`() {
        val from = HexCoordinate(-2, 1)
        val to = HexCoordinate(2, -1)
        val path = AStarPathfinder.findPath(map, from, to)
        assertNotNull(path)
        assertEquals(from, path!!.first())
        assertEquals(to, path.last())
    }

    @Test
    fun `path does not pass through blocked coordinates`() {
        // Block the direct tile at (1,0) so path must detour
        val blocked = setOf(HexCoordinate(1, 0))
        val path = AStarPathfinder.findPath(map, HexCoordinate(0, 0), HexCoordinate(2, 0), blocked)
        assertNotNull(path)
        assertFalse(path!!.contains(HexCoordinate(1, 0)), "path passed through blocked coordinate (1,0)")
    }

    @Test
    fun `returns null when blocked coordinates cut off all routes`() {
        // Surround origin completely with blocked coordinates
        val blocked = setOf(HexCoordinate(1, 0), HexCoordinate(0, 1), HexCoordinate(1, -1),
                            HexCoordinate(-1, 0), HexCoordinate(0, -1), HexCoordinate(-1, 1))
        val smallMap = HexMap.createHexagonal(radius = 1, elevationFn = { 3 })
        assertNull(AStarPathfinder.findPath(smallMap, HexCoordinate(0, 0), HexCoordinate(1, 0), blocked))
    }
}

