package team.dedica.porthole.domain

import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class ConnectionRecalculatorTest {

    private lateinit var map: HexMap
    private lateinit var state: SessionState

    private val coordA = HexCoordinate(0, 0)
    private val coordB = HexCoordinate(4, 0)
    private val coordMid = HexCoordinate(2, 0)

    @BeforeEach
    fun setup() {
        map = HexMap.createHexagonal(radius = 5, elevationFn = { 3 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "alice"))
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun lmUuid(id: String) = UUID.nameUUIDFromBytes(id.toByteArray())

    private fun addLandmark(id: String, coord: HexCoordinate): Landmark {
        val lm = Landmark(id = lmUuid(id), name = id, ownerId = UUID.nameUUIDFromBytes("u1".toByteArray()), coordinate = coord)
        state.landmarks[lm.id] = lm
        return lm
    }

    /** Returns the UUID used as the connection's own id (derived from [id] string). */
    private fun connUuid(id: String) = UUID.nameUUIDFromBytes(id.toByteArray())

    private fun addConnection(id: String, originId: String, targetId: String, explicitPath: List<HexCoordinate>): Connection {
        val conn = Connection(id = connUuid(id), originId = lmUuid(originId), targetId = lmUuid(targetId), path = explicitPath)
        state.connections[conn.id] = conn
        return conn
    }

    // ── recalculateConnectionsCrossingTile ────────────────────────────────────

    @Test
    fun `recalculateConnectionsCrossingTile replaces path that passes through the blocked tile`() {
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        val straightPath = listOf(coordA, HexCoordinate(1, 0), coordMid, HexCoordinate(3, 0), coordB)
        val c1 = addConnection("c1", "A", "B", straightPath)

        addLandmark("C", coordMid)
        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordMid)

        val newPath = state.connections[c1.id]!!.path
        assertFalse(newPath.contains(coordMid), "Path must not contain the now-blocked tile $coordMid")
        assertEquals(coordA, newPath.first(), "Path must still start at A")
        assertEquals(coordB, newPath.last(), "Path must still end at B")
    }

    @Test
    fun `recalculateConnectionsCrossingTile does not alter connections whose path does not cross the tile`() {
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        val detourPath = listOf(coordA, HexCoordinate(1, -1), HexCoordinate(2, -1), HexCoordinate(3, -1), coordB)
        val c1 = addConnection("c1", "A", "B", detourPath)

        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordMid)

        assertEquals(detourPath, state.connections[c1.id]!!.path, "Unaffected connection must remain unchanged")
    }

    @Test
    fun `recalculateConnectionsCrossingTile does not reroute if blocked tile is the connection endpoint`() {
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        val path = listOf(coordA, HexCoordinate(1, 0), HexCoordinate(2, 0), HexCoordinate(3, 0), coordB)
        val c1 = addConnection("c1", "A", "B", path)

        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordB)

        assertEquals(path, state.connections[c1.id]!!.path)
    }

    @Test
    fun `recalculateConnectionsCrossingTile leaves connection intact when no alternative path exists`() {
        val tinyMap = HexMap.createHexagonal(radius = 1, elevationFn = { 3 })
        val tinyState = SessionState(map = tinyMap)
        tinyState.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "alice"))

        val from = HexCoordinate(0, -1)
        val to   = HexCoordinate(0, 1)
        tinyState.landmarks[lmUuid("A")] = Landmark(id = lmUuid("A"), name = "A", ownerId = UUID.nameUUIDFromBytes("u1".toByteArray()), coordinate = from)
        tinyState.landmarks[lmUuid("B")] = Landmark(id = lmUuid("B"), name = "B", ownerId = UUID.nameUUIDFromBytes("u1".toByteArray()), coordinate = to)

        val pathTile = HexCoordinate(0, 0)
        val existingPath = listOf(from, pathTile, to)
        val c1id = connUuid("c1")
        tinyState.connections[c1id] = Connection(id = c1id, originId = lmUuid("A"), targetId = lmUuid("B"), path = existingPath)

        val extraBlockers = listOf(HexCoordinate(1, -1), HexCoordinate(-1, 0), HexCoordinate(1, 0))
        extraBlockers.forEach { coord ->
            val bId = UUID.nameUUIDFromBytes(coord.toString().toByteArray())
            tinyState.landmarks[bId] =
                Landmark(id = bId, name = coord.toString(), ownerId = UUID.nameUUIDFromBytes("u1".toByteArray()), coordinate = coord)
        }
        val pbId = UUID.nameUUIDFromBytes("pathBlock".toByteArray())
        tinyState.landmarks[pbId] =
            Landmark(id = pbId, name = "pb", ownerId = UUID.nameUUIDFromBytes("u1".toByteArray()), coordinate = pathTile)

        ConnectionRecalculator.recalculateConnectionsCrossingTile(tinyState, pathTile)

        assertEquals(existingPath, tinyState.connections[c1id]!!.path,
            "When no route exists, path must be left unchanged")
    }

    @Test
    fun `multiple connections – only those crossing the tile are rerouted`() {
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        val crossingPath = listOf(coordA, HexCoordinate(1, 0), coordMid, HexCoordinate(3, 0), coordB)
        val clearPath = listOf(coordA, HexCoordinate(1, -1), HexCoordinate(2, -1), HexCoordinate(3, -1), coordB)
        val cCross = addConnection("c-cross", "A", "B", crossingPath)
        val cClear = addConnection("c-clear", "A", "B", clearPath)

        addLandmark("C", coordMid)
        ConnectionRecalculator.recalculateConnectionsCrossingTile(state, coordMid)

        assertFalse(state.connections[cCross.id]!!.path.contains(coordMid), "Crossing connection must be rerouted")
        assertEquals(clearPath, state.connections[cClear.id]!!.path, "Clear connection must be untouched")
    }

    // ── recalculateConnectionsInvolvingLandmark ───────────────────────────────

    @Test
    fun `recalculateConnectionsInvolvingLandmark updates path after landmark moves`() {
        addLandmark("A", coordA)
        addLandmark("B", coordB)
        val oldPath = listOf(coordA, HexCoordinate(1, 0), HexCoordinate(2, 0), HexCoordinate(3, 0), coordB)
        val c1 = addConnection("c1", "A", "B", oldPath)

        val newACoord = HexCoordinate(-2, 0)
        state.landmarks[lmUuid("A")] = state.landmarks[lmUuid("A")]!!.copy(coordinate = newACoord)

        ConnectionRecalculator.recalculateConnectionsInvolvingLandmark(state, lmUuid("A"))

        val newPath = state.connections[c1.id]!!.path
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
        val cAb = addConnection("c-ab", "A", "B", abPath)
        val cCd = addConnection("c-cd", "C", "D", cdPath)

        state.landmarks[lmUuid("A")] = state.landmarks[lmUuid("A")]!!.copy(coordinate = HexCoordinate(-1, 0))
        ConnectionRecalculator.recalculateConnectionsInvolvingLandmark(state, lmUuid("A"))

        assertEquals(cdPath, state.connections[cCd.id]!!.path, "C-D connection must be untouched")
    }

    // ── hexLine cube-rounding regression ─────────────────────────────────────

    @Test
    fun `all hexLine coordinates satisfy cube constraint q plus r plus s equals zero`() {
        fun hexLineCubeRound(a: HexCoordinate, b: HexCoordinate): List<HexCoordinate> {
            val aq = a.q.toDouble();
            val ar = a.r.toDouble();
            val `as` = (-a.q - a.r).toDouble()
            val bq = b.q.toDouble();
            val br = b.r.toDouble();
            val bs = (-b.q - b.r).toDouble()
            fun lerp(x: Double, y: Double, t: Double) = x + (y - x) * t
            val n = maxOf(
                kotlin.math.abs(bq - aq).toInt(),
                kotlin.math.abs(br - ar).toInt(),
                kotlin.math.abs(bs - `as`).toInt(),
            )
            if (n == 0) return listOf(a)
            return (0..n).map { i ->
                val t = i.toDouble() / n
                val fq = lerp(aq, bq, t);
                val fr = lerp(ar, br, t);
                val fs = lerp(`as`, bs, t)
                var rq = kotlin.math.round(fq).toInt()
                var rr = kotlin.math.round(fr).toInt()
                var rs = kotlin.math.round(fs).toInt()
                val dq = kotlin.math.abs(rq - fq)
                val dr = kotlin.math.abs(rr - fr)
                val ds = kotlin.math.abs(rs - fs)
                when {
                    dq > dr && dq > ds -> rq = -rr - rs
                    dr > ds -> rr = -rq - rs
                    else -> rs = -rq - rr
                }
                HexCoordinate(rq, rr)
            }
        }

        val testPairs = listOf(
            HexCoordinate(0, -8) to HexCoordinate(0, -6),
            HexCoordinate(-3, 0) to HexCoordinate(3, 2),
            HexCoordinate(0, 2) to HexCoordinate(-3, 3),
            HexCoordinate(3, 0) to HexCoordinate(5, -2),
        )
        for ((a, b) in testPairs) {
            val path = hexLineCubeRound(a, b)
            for (coord in path) {
                assertEquals(
                    0, coord.q + coord.r + coord.s,
                    "Cube constraint violated for $coord on path $a → $b"
                )
            }
        }
    }
}
