package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.landscaping.CreateConnectionUseCase
import team.dedica.porthole.domain.*

class CreateConnectionUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: CreateConnectionUseCase

    private val collaborator1 = Collaborator(id = "p1", username = "Alice")
    private val collaborator2 = Collaborator(id = "p2", username = "Bob")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))

        state.landmarks["t1"] = Landmark(id = "t1", name = "Tower One", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        state.landmarks["t2"] = Landmark(id = "t2", name = "Tower Two", ownerId = "p1", coordinate = HexCoordinate(3, 0))
        state.landmarks["t3"] = Landmark(id = "t3", name = "Tower Three", ownerId = "p2", coordinate = HexCoordinate(-2, 0))

        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
            it.save(UserRecord("p2", "Bob", "gh-2"))
        }

        useCase = CreateConnectionUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `creates connection and path includes start and end coordinates`() {
        val result = useCase.execute(state.id, "t1", "t2")
        assertEquals(1, result.connections.size)
        val conn = result.connections.values.first()
        assertEquals("t1", conn.originId)
        assertEquals("t2", conn.targetId)
        assertEquals(HexCoordinate(0, 0), conn.path.first())
        assertEquals(HexCoordinate(3, 0), conn.path.last())
    }

    @Test
    fun `connecting landmark to itself fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "t1", "t1")
        }
    }

    @Test
    fun `connection between landmarks of different owners succeeds`() {
        val result = useCase.execute(state.id, "t1", "t3")
        assertEquals(1, result.connections.size)
    }

    @Test
    fun `duplicate connection succeeds and creates a second connection`() {
        useCase.execute(state.id, "t1", "t2")
        val saved = mapStatePort.findById(state.id)!!
        val result = useCase.execute(saved.id, "t1", "t2")
        assertEquals(2, result.connections.size)
    }

    @Test
    fun `reverse connection also succeeds`() {
        useCase.execute(state.id, "t1", "t2")
        val saved = mapStatePort.findById(state.id)!!
        val result = useCase.execute(saved.id, "t2", "t1")
        assertEquals(2, result.connections.size)
    }

    @Test
    fun `connection succeeds even with water tiles between landmarks`() {
        val tiles = mutableListOf<HexTile>()
        for (q in -1..4) {
            for (r in -2..2) {
                val elev = if (q == 1) 0 else 3
                tiles += HexTile(HexCoordinate(q, r), elevation = elev)
            }
        }
        val waterState = MapState(map = HexMap(tiles))
        waterState.collaborators.add(collaborator1)
        waterState.landmarks["ta"] = Landmark(id = "ta", name = "Landmark A", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        waterState.landmarks["tb"] = Landmark(id = "tb", name = "Landmark B", ownerId = "p1", coordinate = HexCoordinate(3, 0))
        mapStatePort.save(waterState)
        val result = useCase.execute(waterState.id, "ta", "tb")
        assertEquals(1, result.connections.size)
    }

    @Test
    fun `unknown landmark id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "t1", "unknown")
        }
    }

    @Test
    fun `connection fails when only route passes through another landmark`() {
        val tiles = mutableListOf<HexTile>()
        for (q in 0..3) {
            tiles += HexTile(HexCoordinate(q, 0), elevation = 3)
        }
        val corridorState = MapState(map = HexMap(tiles))
        corridorState.collaborators.addAll(listOf(collaborator1, collaborator2))
        corridorState.landmarks["ta"] = Landmark(id = "ta", name = "Landmark A", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        corridorState.landmarks["tb"] = Landmark(id = "tb", name = "Landmark B", ownerId = "p1", coordinate = HexCoordinate(3, 0))
        corridorState.landmarks["tc"] = Landmark(id = "tc", name = "Landmark C", ownerId = "p2", coordinate = HexCoordinate(1, 0))
        corridorState.landmarks["td"] = Landmark(id = "td", name = "Landmark D", ownerId = "p2", coordinate = HexCoordinate(2, 0))
        mapStatePort.save(corridorState)
        assertThrows(IllegalStateException::class.java) {
            useCase.execute(corridorState.id, "ta", "tb")
        }
    }

    @Test
    fun `default type is PIPE when not specified`() {
        val result = useCase.execute(state.id, "t1", "t2")
        val conn = result.connections.values.first()
        assertEquals(ConnectionType.PIPE, conn.type)
        assertNull(conn.name)
        assertNull(conn.description)
    }

    @Test
    fun `connection with explicit type name and description is stored correctly`() {
        val result = useCase.execute(state.id, "t1", "t2", ConnectionType.STREET, "Main Road", "Connects north and south")
        val conn = result.connections.values.first()
        assertEquals(ConnectionType.STREET, conn.type)
        assertEquals("Main Road", conn.name)
        assertEquals("Connects north and south", conn.description)
    }

    @Test
    fun `blank name throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "t1", "t2", ConnectionType.PIPE, "   ")
        }
    }

    @Test
    fun `blank description throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "t1", "t2", ConnectionType.PIPE, null, "  ")
        }
    }

    @Test
    fun `name and description are trimmed before storing`() {
        val result = useCase.execute(state.id, "t1", "t2", ConnectionType.TELEGRAPH, "  Wire Line  ", "  Old telegraph  ")
        val conn = result.connections.values.first()
        assertEquals("Wire Line", conn.name)
        assertEquals("Old telegraph", conn.description)
    }
}
