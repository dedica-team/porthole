package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.landscaping.CreateConnectionUseCase
import team.dedica.porthole.application.session.landscaping.PositionLandmarkUseCase
import team.dedica.porthole.application.session.metrics.CreateUnpositionedLandmarkUseCase
import team.dedica.porthole.domain.*

class PositionLandmarkUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var positionUseCase: PositionLandmarkUseCase
    private lateinit var createUseCase: CreateUnpositionedLandmarkUseCase
    private lateinit var createConnectionUseCase: CreateConnectionUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "p1", username = "Alice"))
        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        val userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }
        createUseCase = CreateUnpositionedLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        positionUseCase = PositionLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        createConnectionUseCase = CreateConnectionUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `positions unpositioned landmark on tile`() {
        createUseCase.execute(state.id, "Alice", "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        val result = positionUseCase.execute(saved.id, "Alice", "iron-keep", HexCoordinate(0, 0))
        val lm = result.getLandmarkAt(HexCoordinate(0, 0))
        assertNotNull(lm)
        assertEquals("iron-keep", lm!!.id)
        assertEquals(HexCoordinate(0, 0), lm.coordinate)
    }

    @Test
    fun `relocating an already-positioned landmark succeeds`() {
        createUseCase.execute(state.id, "Alice", "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        positionUseCase.execute(saved.id, "Alice", "iron-keep", HexCoordinate(0, 0))
        val saved2 = mapStatePort.findById(state.id)!!
        // Moving to a different tile should succeed (relocation)
        val result = positionUseCase.execute(saved2.id, "Alice", "iron-keep", HexCoordinate(1, 0))
        assertEquals(HexCoordinate(1, 0), result.getLandmarkAt(HexCoordinate(1, 0))?.coordinate)
        assertNull(result.getLandmarkAt(HexCoordinate(0, 0)))
        // Old tile ownership should be cleared
        assertNull(result.map.getTile(HexCoordinate(0, 0))?.ownerId)
    }

    @Test
    fun `relocating to same tile is a no-op and succeeds`() {
        createUseCase.execute(state.id, "Alice", "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        positionUseCase.execute(saved.id, "Alice", "iron-keep", HexCoordinate(0, 0))
        val saved2 = mapStatePort.findById(state.id)!!
        // Re-positioning on the same tile should be allowed
        val result = positionUseCase.execute(saved2.id, "Alice", "iron-keep", HexCoordinate(0, 0))
        assertEquals(HexCoordinate(0, 0), result.getLandmarkAt(HexCoordinate(0, 0))?.coordinate)
    }

    @Test
    fun `tile occupied by another landmark fails`() {
        createUseCase.execute(state.id, "Alice", "Iron Keep")
        val s1 = mapStatePort.findById(state.id)!!
        createUseCase.execute(s1.id, "Alice", "Stone Fort")
        val s2 = mapStatePort.findById(state.id)!!
        positionUseCase.execute(s2.id, "Alice", "iron-keep", HexCoordinate(0, 0))
        val s3 = mapStatePort.findById(state.id)!!
        assertThrows(IllegalArgumentException::class.java) {
            positionUseCase.execute(s3.id, "Alice", "stone-fort", HexCoordinate(0, 0))
        }
    }

    @Test
    fun `nonexistent landmark fails`() {
        assertThrows(NoSuchElementException::class.java) {
            positionUseCase.execute(state.id, "Alice", "no-such-landmark", HexCoordinate(0, 0))
        }
    }

    @Test
    fun `nonexistent tile fails`() {
        createUseCase.execute(state.id, "Alice", "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        assertThrows(IllegalStateException::class.java) {
            positionUseCase.execute(saved.id, "Alice", "iron-keep", HexCoordinate(999, 999))
        }
    }

    @Test
    fun `connection paths are recalculated after relocation`() {
        // Place two landmarks and connect them
        createUseCase.execute(state.id, "Alice", "Iron Keep")
        val s1 = mapStatePort.findById(state.id)!!
        createUseCase.execute(s1.id, "Alice", "Stone Fort")
        val s2 = mapStatePort.findById(state.id)!!
        positionUseCase.execute(s2.id, "Alice", "iron-keep", HexCoordinate(0, 0))
        val s3 = mapStatePort.findById(state.id)!!
        positionUseCase.execute(s3.id, "Alice", "stone-fort", HexCoordinate(2, 0))
        val s4 = mapStatePort.findById(state.id)!!
        createConnectionUseCase.execute(s4.id, "iron-keep", "stone-fort")
        val s5 = mapStatePort.findById(state.id)!!

        val originalPath = s5.connections.values.first().path
        assertFalse(originalPath.isEmpty())

        // Relocate iron-keep to a new position
        val result = positionUseCase.execute(s5.id, "Alice", "iron-keep", HexCoordinate(-1, 0))

        val updatedPath = result.connections.values.first().path
        // Path must start at the new position
        assertEquals(HexCoordinate(-1, 0), updatedPath.first())
        // Path must end at stone-fort's position
        assertEquals(HexCoordinate(2, 0), updatedPath.last())
        // Path must differ from the original (different start tile)
        assertNotEquals(originalPath, updatedPath)
    }

    // ── Bug regression: PositionLandmarkUseCase did not reroute third-party connections ──

    @Test
    fun `repositioning landmark onto a tile reroutes third-party connections crossing that tile`() {
        // Landmarks B and C connected via a path through (0,0).
        // Landmark A is then positioned at (0,0) – the B-C connection must be rerouted.
        createUseCase.execute(state.id, "Alice", "Alpha")
        val s1 = mapStatePort.findById(state.id)!!
        createUseCase.execute(s1.id, "Alice", "Beta")
        val s2 = mapStatePort.findById(state.id)!!
        createUseCase.execute(s2.id, "Alice", "Gamma")
        val s3 = mapStatePort.findById(state.id)!!

        // Position Beta and Gamma on opposite sides so their A* path crosses (0,0)
        positionUseCase.execute(s3.id, "Alice", "beta", HexCoordinate(-2, 0))
        val s4 = mapStatePort.findById(state.id)!!
        positionUseCase.execute(s4.id, "Alice", "gamma", HexCoordinate(2, 0))
        val s5 = mapStatePort.findById(state.id)!!

        // Connect Beta ↔ Gamma
        createConnectionUseCase.execute(s5.id, "beta", "gamma")
        val s6 = mapStatePort.findById(state.id)!!

        val bgPath = s6.connections.values.first { it.originId == "beta" || it.targetId == "beta" }.path
        assertTrue(bgPath.contains(HexCoordinate(0, 0)),
            "Precondition: Beta-Gamma path must cross (0,0); got $bgPath")

        // Now reposition Alpha onto (0,0) – this is the bug scenario
        val result = positionUseCase.execute(s6.id, "Alice", "alpha", HexCoordinate(0, 0))

        val updatedBgPath = result.connections.values.first { it.originId == "beta" || it.targetId == "beta" }.path
        assertFalse(updatedBgPath.contains(HexCoordinate(0, 0)),
            "After Alpha is placed at (0,0), Beta-Gamma connection must not route through it; got $updatedBgPath")
        // Endpoints must be preserved
        val ends = setOf(updatedBgPath.first(), updatedBgPath.last())
        assertTrue(ends.contains(HexCoordinate(-2, 0)), "Path must still start or end at Beta")
        assertTrue(ends.contains(HexCoordinate(2, 0)), "Path must still start or end at Gamma")
    }
}

