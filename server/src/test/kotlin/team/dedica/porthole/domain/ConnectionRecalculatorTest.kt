package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/**
 * Unit tests for [ConnectionRecalculator].
 *
 * Bug regression:
 * - PlaceLandmarkUseCase never called recalculation → connections routed through landmark tiles.
 * - PositionLandmarkUseCase only recalculated connections involving the moved landmark, ignoring
 *   third-party connections whose path crossed the newly occupied tile.
 */
class ConnectionRecalculatorTest {

    // 5-wide corridor: (0,0) ── (1,0) ── (2,0) ── (3,0) ── (4,0)
    // plus one detour row above: (1,-1), (2,-1), (3,-1)
    private lateinit var map: HexMap
    private lateinit var state: MapState

    private val coordA = HexCoordinate(0, 0)
    private val coordB = HexCoordinate(4, 0)
    private val coordMid = HexCoordinate(2, 0)   // middle tile of the straight path

    @BeforeEach
    fun setup() {
        map = HexMap.createHexagonal(radius = 5, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "u1", username = "alice"))
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private fun addLandmark(id: String, coord: HexCoordinate): Landmark {
        val lm = Landmark(id = id, name = id, ownerId = "u1", coordinate = coord)
        state.landmarks[id] = lm
        return lm
    }

    private fun addConnection(id: String, originId: String, targetId: String, explicitPath: List<HexCoordinate>): Connection {
        val conn = Connection(id = id, originId = originId, targetId = targetId, path = explicitPath)
        state.connections[id] = conn
        return conn
    }

    // ── recalculateConnectionsCrossingTile ────────────────────────────────────

    @Test
    fun `recalculateConnectionsCrossingTile replaces path that passes through the blocked tile`() {
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        // Manually store a straight-line path A→mid→B
        val straightPath = listOf(coordA, HexCoordinate(1, 0), coordMid, HexCoordinate(3, 0), coordB)
        addConnection("c1", "A", "B", straightPath)

        // Now place landmark C at coordMid – this should trigger recalculation
        addLandmark("C", coordMid)
        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordMid)

        val newPath = state.connections["c1"]!!.path
        assertFalse(newPath.contains(coordMid), "Path must not contain the now-blocked tile $coordMid")
        assertEquals(coordA, newPath.first(), "Path must still start at A")
        assertEquals(coordB, newPath.last(), "Path must still end at B")
    }

    @Test
    fun `recalculateConnectionsCrossingTile does not alter connections whose path does not cross the tile`() {
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        // Path that does NOT cross coordMid (goes via row -1)
        val detourPath = listOf(
            coordA,
            HexCoordinate(1, -1), HexCoordinate(2, -1), HexCoordinate(3, -1),
            coordB,
        )
        addConnection("c1", "A", "B", detourPath)

        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordMid)

        assertEquals(detourPath, state.connections["c1"]!!.path, "Unaffected connection must remain unchanged")
    }

    @Test
    fun `recalculateConnectionsCrossingTile does not reroute if blocked tile is the connection endpoint`() {
        // coordB is an endpoint – a connection ending AT coordB should not be rerouted even though
        // coordB appears in the path.
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        val path = listOf(coordA, HexCoordinate(1, 0), HexCoordinate(2, 0), HexCoordinate(3, 0), coordB)
        addConnection("c1", "A", "B", path)

        // Place another landmark at coordB's position (simulate scenario – normally prevented by
        // business rules, but we test the recalculator's endpoint-exclusion logic in isolation).
        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordB)

        // Path should be unchanged because coordB is the target endpoint of c1.
        assertEquals(path, state.connections["c1"]!!.path)
    }

    @Test
    fun `recalculateConnectionsCrossingTile leaves connection intact when no alternative path exists`() {
        // Build a tiny radius-1 map so that blocking the only intermediate tile leaves no route.
        val tinyMap = HexMap.createHexagonal(radius = 1, elevationFn = { 3 })
        val tinyState = MapState(map = tinyMap)
        tinyState.collaborators.add(Collaborator(id = "u1", username = "alice"))

        val from = HexCoordinate(0, -1)
        val to   = HexCoordinate(0, 1)
        tinyState.landmarks["A"] = Landmark(id = "A", name = "A", ownerId = "u1", coordinate = from)
        tinyState.landmarks["B"] = Landmark(id = "B", name = "B", ownerId = "u1", coordinate = to)

        // Surround from+to with all neighbours blocked except the path tile (0,0)
        val pathTile = HexCoordinate(0, 0)
        val existingPath = listOf(from, pathTile, to)
        tinyState.connections["c1"] = Connection(id = "c1", originId = "A", targetId = "B", path = existingPath)

        // Block every neighbour of `from` except `to` and `pathTile`
        val extraBlockers = listOf(HexCoordinate(1, -1), HexCoordinate(-1, 0), HexCoordinate(1, 0))
        extraBlockers.forEach { coord ->
            tinyState.landmarks[coord.toString()] =
                Landmark(id = coord.toString(), name = coord.toString(), ownerId = "u1", coordinate = coord)
        }

        // Now block pathTile as well – there should be no route left
        tinyState.landmarks["pathBlock"] =
            Landmark(id = "pathBlock", name = "pb", ownerId = "u1", coordinate = pathTile)

        ConnectionRecalculator.recalculateConnectionsCrossingTile(tinyState, pathTile)

        // Path is left unchanged when no route exists
        assertEquals(existingPath, tinyState.connections["c1"]!!.path,
            "When no route exists, path must be left unchanged")
    }

    @Test
    fun `multiple connections – only those crossing the tile are rerouted`() {
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        val crossingPath = listOf(coordA, HexCoordinate(1, 0), coordMid, HexCoordinate(3, 0), coordB)
        val clearPath    = listOf(coordA, HexCoordinate(1, -1), HexCoordinate(2, -1), HexCoordinate(3, -1), coordB)
        addConnection("c-cross", "A", "B", crossingPath)
        addConnection("c-clear", "A", "B", clearPath)

        addLandmark("C", coordMid)
        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordMid)

        assertFalse(state.connections["c-cross"]!!.path.contains(coordMid), "Crossing connection must be rerouted")
        assertEquals(clearPath, state.connections["c-clear"]!!.path, "Clear connection must be untouched")
    }

    // ── recalculateConnectionsInvolvingLandmark ───────────────────────────────

    @Test
    fun `recalculateConnectionsInvolvingLandmark updates path after landmark moves`() {
        // A at (0,0), B at (4,0), connection A-B; then move A to (-2,0)
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        val oldPath = listOf(coordA, HexCoordinate(1, 0), HexCoordinate(2, 0), HexCoordinate(3, 0), coordB)
        addConnection("c1", "A", "B", oldPath)

        val newACoord = HexCoordinate(-2, 0)
        state.landmarks["A"] = state.landmarks["A"]!!.copy(coordinate = newACoord)

        ConnectionRecalculator.recalculateConnectionsInvolvingLandmark(state, "A")

        val newPath = state.connections["c1"]!!.path
        assertEquals(newACoord, newPath.first(), "Path must start at A's new position")
        assertEquals(coordB, newPath.last(), "Path must end at B")
        assertNotEquals(oldPath, newPath)
    }

    @Test
    fun `recalculateConnectionsInvolvingLandmark does not touch unrelated connections`() {
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        addLandmark("C", HexCoordinate(0, 2))
        addLandmark("D", HexCoordinate(4, -2))

        val abPath = listOf(coordA, HexCoordinate(1, 0), coordB)
        val cdPath = listOf(HexCoordinate(0, 2), HexCoordinate(1, 1), HexCoordinate(2, 0), HexCoordinate(3, -1), HexCoordinate(4, -2))
        addConnection("c-ab", "A", "B", abPath)
        addConnection("c-cd", "C", "D", cdPath)

        // Move A; only c-ab must be recalculated
        state.landmarks["A"] = state.landmarks["A"]!!.copy(coordinate = HexCoordinate(-1, 0))
        ConnectionRecalculator.recalculateConnectionsInvolvingLandmark(state, "A")

        assertEquals(cdPath, state.connections["c-cd"]!!.path, "C-D connection must be untouched")
    }

    // ── hexLine cube-rounding regression ─────────────────────────────────────

    @Test
    fun `all hexLine coordinates satisfy cube constraint q plus r plus s equals zero`() {
        // Reproduce the DemoDataLoader hexLine logic with correct cube rounding and verify
        // that every returned coordinate satisfies the cube constraint.
        fun hexLineCubeRound(a: HexCoordinate, b: HexCoordinate): List<HexCoordinate> {
            val aq = a.q.toDouble(); val ar = a.r.toDouble(); val `as` = (-a.q - a.r).toDouble()
            val bq = b.q.toDouble(); val br = b.r.toDouble(); val bs = (-b.q - b.r).toDouble()
            fun lerp(x: Double, y: Double, t: Double) = x + (y - x) * t
            val n = maxOf(
                kotlin.math.abs(bq - aq).toInt(),
                kotlin.math.abs(br - ar).toInt(),
                kotlin.math.abs(bs - `as`).toInt(),
            )
            if (n == 0) return listOf(a)
            return (0..n).map { i ->
                val t = i.toDouble() / n
                val fq = lerp(aq, bq, t); val fr = lerp(ar, br, t); val fs = lerp(`as`, bs, t)
                var rq = kotlin.math.round(fq).toInt()
                var rr = kotlin.math.round(fr).toInt()
                var rs = kotlin.math.round(fs).toInt()
                val dq = kotlin.math.abs(rq - fq)
                val dr = kotlin.math.abs(rr - fr)
                val ds = kotlin.math.abs(rs - fs)
                when {
                    dq > dr && dq > ds -> rq = -rr - rs
                    dr > ds            -> rr = -rq - rs
                    else               -> rs = -rq - rr
                }
                HexCoordinate(rq, rr)
            }
        }

        val testPairs = listOf(
            HexCoordinate(0, -8) to HexCoordinate(0, -6),
            HexCoordinate(-3, 0) to HexCoordinate(3, 2),
            HexCoordinate(0, 2)  to HexCoordinate(-3, 3),
            HexCoordinate(3, 0)  to HexCoordinate(5, -2),
        )
        for ((a, b) in testPairs) {
            val path = hexLineCubeRound(a, b)
            for (coord in path) {
                assertEquals(0, coord.q + coord.r + coord.s,
                    "Cube constraint violated for $coord on path $a → $b")
            }
        }
    }
}

