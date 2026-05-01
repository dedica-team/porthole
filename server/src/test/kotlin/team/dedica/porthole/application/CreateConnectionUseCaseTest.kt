package team.dedica.porthole.application
import java.util.UUID

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

    private val collaborator1 = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val t1Id = UUID.nameUUIDFromBytes("t1".toByteArray())
    private val t2Id = UUID.nameUUIDFromBytes("t2".toByteArray())
    private val t3Id = UUID.nameUUIDFromBytes("t3".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))

        state.landmarks[t1Id] = Landmark(id = t1Id, name = "Tower One", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(0, 0))
        state.landmarks[t2Id] = Landmark(id = t2Id, name = "Tower Two", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(3, 0))
        state.landmarks[t3Id] = Landmark(id = t3Id, name = "Tower Three", ownerId = UUID.nameUUIDFromBytes("p2".toByteArray()), coordinate = HexCoordinate(-2, 0))

        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
            it.save(UserRecord(UUID.nameUUIDFromBytes("p2".toByteArray()), "Bob", "gh-2"))
        }

        useCase = CreateConnectionUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `creates connection and path includes start and end coordinates`() {
        val result = useCase.execute(state.id, t1Id, t2Id)
        assertEquals(1, result.connections.size)
        val conn = result.connections.values.first()
        assertEquals(t1Id, conn.originId)
        assertEquals(t2Id, conn.targetId)
        assertEquals(HexCoordinate(0, 0), conn.path.first())
        assertEquals(HexCoordinate(3, 0), conn.path.last())
    }

    @Test
    fun `connecting landmark to itself fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, t1Id, t1Id)
        }
    }

    @Test
    fun `connection between landmarks of different owners succeeds`() {
        val result = useCase.execute(state.id, t1Id, t3Id)
        assertEquals(1, result.connections.size)
    }

    @Test
    fun `duplicate connection succeeds and creates a second connection`() {
        useCase.execute(state.id, t1Id, t2Id)
        val saved = mapStatePort.findById(state.id)!!
        val result = useCase.execute(saved.id, t1Id, t2Id)
        assertEquals(2, result.connections.size)
    }

    @Test
    fun `reverse connection also succeeds`() {
        useCase.execute(state.id, t1Id, t2Id)
        val saved = mapStatePort.findById(state.id)!!
        val result = useCase.execute(saved.id, t2Id, t1Id)
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
        val taId = UUID.nameUUIDFromBytes("ta".toByteArray())
        val tbId = UUID.nameUUIDFromBytes("tb".toByteArray())
        waterState.landmarks[taId] = Landmark(id = taId, name = "Landmark A", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(0, 0))
        waterState.landmarks[tbId] = Landmark(id = tbId, name = "Landmark B", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(3, 0))
        mapStatePort.save(waterState)
        val result = useCase.execute(waterState.id, taId, tbId)
        assertEquals(1, result.connections.size)
    }

    @Test
    fun `unknown landmark id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, t1Id, UUID.randomUUID())
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
        val taId = UUID.nameUUIDFromBytes("ta".toByteArray())
        val tbId = UUID.nameUUIDFromBytes("tb".toByteArray())
        val tcId = UUID.nameUUIDFromBytes("tc".toByteArray())
        val tdId = UUID.nameUUIDFromBytes("td".toByteArray())
        corridorState.landmarks[taId] = Landmark(id = taId, name = "Landmark A", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(0, 0))
        corridorState.landmarks[tbId] = Landmark(id = tbId, name = "Landmark B", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(3, 0))
        corridorState.landmarks[tcId] = Landmark(id = tcId, name = "Landmark C", ownerId = UUID.nameUUIDFromBytes("p2".toByteArray()), coordinate = HexCoordinate(1, 0))
        corridorState.landmarks[tdId] = Landmark(id = tdId, name = "Landmark D", ownerId = UUID.nameUUIDFromBytes("p2".toByteArray()), coordinate = HexCoordinate(2, 0))
        mapStatePort.save(corridorState)
        assertThrows(IllegalStateException::class.java) {
            useCase.execute(corridorState.id, taId, tbId)
        }
    }

    @Test
    fun `default type is PIPE when not specified`() {
        val result = useCase.execute(state.id, t1Id, t2Id)
        val conn = result.connections.values.first()
        assertEquals(ConnectionType.PIPE, conn.type)
        assertNull(conn.name)
        assertNull(conn.description)
    }

    @Test
    fun `connection with explicit type name and description is stored correctly`() {
        val result = useCase.execute(state.id, t1Id, t2Id, ConnectionType.STREET, "Main Road", "Connects north and south")
        val conn = result.connections.values.first()
        assertEquals(ConnectionType.STREET, conn.type)
        assertEquals("Main Road", conn.name)
        assertEquals("Connects north and south", conn.description)
    }

    @Test
    fun `blank name throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, t1Id, t2Id, ConnectionType.PIPE, "   ")
        }
    }

    @Test
    fun `blank description throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, t1Id, t2Id, ConnectionType.PIPE, null, "  ")
        }
    }

    @Test
    fun `name and description are trimmed before storing`() {
        val result = useCase.execute(state.id, t1Id, t2Id, ConnectionType.TELEGRAPH, "  Wire Line  ", "  Old telegraph  ")
        val conn = result.connections.values.first()
        assertEquals("Wire Line", conn.name)
        assertEquals("Old telegraph", conn.description)
    }
}
