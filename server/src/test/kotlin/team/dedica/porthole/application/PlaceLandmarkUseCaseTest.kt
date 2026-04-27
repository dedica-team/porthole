package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.landscaping.CreateConnectionUseCase
import team.dedica.porthole.application.session.landscaping.PlaceLandmarkUseCase
import team.dedica.porthole.application.session.landscaping.PositionLandmarkUseCase
import team.dedica.porthole.application.session.metrics.CreateUnpositionedLandmarkUseCase
import team.dedica.porthole.domain.*

class PlaceLandmarkUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var useCase: PlaceLandmarkUseCase
    private lateinit var userPort: InMemoryTestUserRepository

    private val collaborator1 = Collaborator(id = "p1", username = "Alice")
    private val collaborator2 = Collaborator(id = "p2", username = "Bob")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))
        state.map.setOwner(HexCoordinate(0, 0), "p1")

        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)

        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
            it.save(UserRecord("p2", "Bob", "gh-2"))
        }
        useCase = PlaceLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `place landmark on tile succeeds`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "Iron Keep")
        val landmark = result.getLandmarkAt(HexCoordinate(0, 0))
        assertNotNull(landmark)
        assertNull(landmark!!.ownerId)
        assertEquals(LandmarkType.KEEP, landmark.type)
    }

    @Test
    fun `placed landmark has correct name`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "Iron Keep")
        val landmark = result.getLandmarkAt(HexCoordinate(0, 0))
        assertNotNull(landmark)
        assertEquals("Iron Keep", landmark!!.name)
    }

    @Test
    fun `name is converted to slug as id`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "Iron Keep")
        val landmark = result.getLandmarkAt(HexCoordinate(0, 0))
        assertNotNull(landmark)
        assertEquals("iron-keep", landmark!!.id)
    }

    @Test
    fun `name with special chars produces valid slug`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "  North Gate!! 42 ")
        val landmark = result.getLandmarkAt(HexCoordinate(0, 0))
        assertNotNull(landmark)
        assertEquals("north-gate-42", landmark!!.id)
    }

    @Test
    fun `duplicate slug name fails`() {
        useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(saved.id, "Alice", HexCoordinate(1, 0), "iron keep")
        }
    }

    @Test
    fun `empty name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "")
        }
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "   ")
        }
    }

    @Test
    fun `default type is KEEP`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "Iron Keep")
        assertEquals(LandmarkType.KEEP, result.getLandmarkAt(HexCoordinate(0, 0))!!.type)
    }

    @Test
    fun `custom type is stored correctly`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "Old Ruins", LandmarkType.RUINS)
        assertEquals(LandmarkType.RUINS, result.getLandmarkAt(HexCoordinate(0, 0))!!.type)
    }

    @Test
    fun `placed landmark is stored in game state`() {
        val coord = HexCoordinate(0, 0)
        val result = useCase.execute(state.id, "Alice", coord, "Iron Keep")
        val stored = result.getLandmarkAt(coord)
        assertNotNull(stored)
        assertEquals(LandmarkType.KEEP, stored!!.type)
    }

    @Test
    fun `place landmark on any tile succeeds`() {
        val coord = HexCoordinate(2, -1)
        val result = useCase.execute(state.id, "Alice", coord, "Outer Post")
        assertEquals(coord, result.getLandmarkAt(coord)!!.coordinate)
    }

    @Test
    fun `place landmark on water tile succeeds`() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 0 })
        val waterState = MapState(map = map)
        waterState.collaborators.add(collaborator1)
        mapStatePort.save(waterState)
        val result = useCase.execute(waterState.id, "Alice", HexCoordinate(0, 0), "Sea Fortress")
        assertNotNull(result.getLandmarkAt(HexCoordinate(0, 0)))
    }

    @Test
    fun `place landmark where one already exists fails`() {
        val coord = HexCoordinate(0, 0)
        useCase.execute(state.id, "Alice", coord, "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(saved.id, "Bob", coord, "Steel Fort")
        }
    }

    // ── WALL tests ────────────────────────────────────────────────────────────

    private val UUID_RE = Regex(
        "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        RegexOption.IGNORE_CASE,
    )

    @Test
    fun `WALL landmark gets a UUID as id, not a slug`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "North Wall", LandmarkType.WALL)
        val landmark = result.getLandmarkAt(HexCoordinate(0, 0))!!
        assertTrue(UUID_RE.matches(landmark.id), "Expected UUID id, got: ${landmark.id}")
    }

    @Test
    fun `WALL landmark id is not derived from the name`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "North Wall", LandmarkType.WALL)
        val id = result.getLandmarkAt(HexCoordinate(0, 0))!!.id
        assertFalse(id.contains("north"), "WALL id should not contain name slug, got: $id")
    }

    @Test
    fun `WALL landmark preserves its name`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "North Wall", LandmarkType.WALL)
        assertEquals("North Wall", result.getLandmarkAt(HexCoordinate(0, 0))!!.name)
    }

    @Test
    fun `two WALL landmarks with the same name can coexist`() {
        useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "East Wall", LandmarkType.WALL)
        val saved = mapStatePort.findById(state.id)!!
        // Should NOT throw – each gets a distinct UUID
        assertDoesNotThrow {
            useCase.execute(saved.id, "Alice", HexCoordinate(1, 0), "East Wall", LandmarkType.WALL)
        }
        val final = mapStatePort.findById(state.id)!!
        val wallIds = final.landmarks.values
            .filter { it.type == LandmarkType.WALL }
            .map { it.id }
        assertEquals(2, wallIds.size)
        assertEquals(2, wallIds.toSet().size, "Wall ids must be unique")
    }

    @Test
    fun `each WALL placement produces a distinct UUID`() {
        useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "Wall A", LandmarkType.WALL)
        val mid = mapStatePort.findById(state.id)!!
        useCase.execute(mid.id, "Alice", HexCoordinate(1, 0), "Wall B", LandmarkType.WALL)
        val final = mapStatePort.findById(state.id)!!
        val ids = final.landmarks.values
            .filter { it.type == LandmarkType.WALL }
            .map { it.id }
        assertEquals(2, ids.toSet().size, "Each WALL must have a unique UUID")
        ids.forEach { assertTrue(UUID_RE.matches(it), "Not a UUID: $it") }
    }

    @Test
    fun `non-WALL landmark still uses slug id`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), "Iron Keep")
        assertEquals("iron-keep", result.getLandmarkAt(HexCoordinate(0, 0))!!.id)
    }

    // ── Connection recalculation regression (Bug fix: PlaceLandmark never rerouted) ──

    @Test
    fun `placing landmark on tile reroutes connections that crossed that tile`() {
        // Arrange: two landmarks at opposite ends, connected through (1,0)
        val positionUseCase = PositionLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        val createUnpositioned = CreateUnpositionedLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        val createConn = CreateConnectionUseCase(mapStatePort, userPort, NoOpBroadcastPort())

        createUnpositioned.execute(state.id, "Alice", "Alpha")
        val s1 = mapStatePort.findById(state.id)!!
        createUnpositioned.execute(s1.id, "Alice", "Beta")
        val s2 = mapStatePort.findById(state.id)!!
        positionUseCase.execute(s2.id, "Alice", "alpha", HexCoordinate(-2, 0))
        val s3 = mapStatePort.findById(state.id)!!
        positionUseCase.execute(s3.id, "Alice", "beta", HexCoordinate(2, 0))
        val s4 = mapStatePort.findById(state.id)!!
        createConn.execute(s4.id, "alpha", "beta")
        val s5 = mapStatePort.findById(state.id)!!

        // The straight A* path from (-2,0) to (2,0) passes through (0,0).
        val beforePath = s5.connections.values.first().path
        assertTrue(beforePath.contains(HexCoordinate(0, 0)), "Precondition: path crosses (0,0)")

        // Act: place a new landmark at (0,0) – this should trigger rerouting
        val result = useCase.execute(s5.id, "Alice", HexCoordinate(0, 0), "Gamma")

        // Assert: connection no longer routes through (0,0)
        val afterPath = result.connections.values.first().path
        assertFalse(afterPath.contains(HexCoordinate(0, 0)),
            "After placing landmark at (0,0), connection must not route through it")
        assertEquals(HexCoordinate(-2, 0), afterPath.first())
        assertEquals(HexCoordinate(2, 0), afterPath.last())
    }

    @Test
    fun `placing landmark does not affect connections whose path does not cross that tile`() {
        val positionUseCase = PositionLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        val createUnpositioned = CreateUnpositionedLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        val createConn = CreateConnectionUseCase(mapStatePort, userPort, NoOpBroadcastPort())

        createUnpositioned.execute(state.id, "Alice", "Alpha")
        val s1 = mapStatePort.findById(state.id)!!
        createUnpositioned.execute(s1.id, "Alice", "Beta")
        val s2 = mapStatePort.findById(state.id)!!
        // Place far apart so the path does not cross (2,2)
        positionUseCase.execute(s2.id, "Alice", "alpha", HexCoordinate(-2, 0))
        val s3 = mapStatePort.findById(state.id)!!
        positionUseCase.execute(s3.id, "Alice", "beta", HexCoordinate(2, 0))
        val s4 = mapStatePort.findById(state.id)!!
        createConn.execute(s4.id, "alpha", "beta")
        val s5 = mapStatePort.findById(state.id)!!
        val beforePath = s5.connections.values.first().path

        // Place new landmark far away from the existing connection path
        val result = useCase.execute(s5.id, "Alice", HexCoordinate(0, 3), "Far Outpost")

        val afterPath = result.connections.values.first().path
        assertEquals(beforePath, afterPath, "Connection not crossing (0,3) must be unchanged")
    }
}
