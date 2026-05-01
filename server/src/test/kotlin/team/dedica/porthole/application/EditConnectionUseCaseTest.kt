package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.landscaping.EditConnectionUseCase
import team.dedica.porthole.domain.*

class EditConnectionUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: EditConnectionUseCase

    private val t1Id = UUID.nameUUIDFromBytes("t1".toByteArray())
    private val t2Id = UUID.nameUUIDFromBytes("t2".toByteArray())
    private val c1Id = UUID.nameUUIDFromBytes("c1".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        state.landmarks[t1Id] =
            Landmark(id = t1Id, name = "Tower One", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(0, 0))
        state.landmarks[t2Id] =
            Landmark(id = t2Id, name = "Tower Two", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(3, 0))
        state.connections[c1Id] = Connection(
            id = c1Id,
            originId = t1Id,
            targetId = t2Id,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(3, 0)),
            type = ConnectionType.PIPE,
        )
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
        }
        useCase = EditConnectionUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `change type from PIPE to TELEGRAPH`() {
        val result = useCase.execute(state.id, c1Id, type = ConnectionType.TELEGRAPH)
        assertEquals(ConnectionType.TELEGRAPH, result.connections[c1Id]!!.type)
    }

    @Test
    fun `set name on connection`() {
        val result = useCase.execute(state.id, c1Id, name = "Supply Line")
        assertEquals("Supply Line", result.connections[c1Id]!!.name)
    }

    @Test
    fun `clear name via clearName flag`() {
        useCase.execute(state.id, c1Id, name = "Supply Line")
        val saved = mapStatePort.findById(state.id)!!
        val result = useCase.execute(saved.id, c1Id, clearName = true)
        assertNull(result.connections[c1Id]!!.name)
    }

    @Test
    fun `set and clear description`() {
        val withDesc = useCase.execute(state.id, c1Id, description = "Important route")
        assertEquals("Important route", withDesc.connections[c1Id]!!.description)

        val saved = mapStatePort.findById(state.id)!!
        val cleared = useCase.execute(saved.id, c1Id, clearDescription = true)
        assertNull(cleared.connections[c1Id]!!.description)
    }

    @Test
    fun `blank name throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, c1Id, name = "   ")
        }
    }

    @Test
    fun `blank description throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, c1Id, description = "  ")
        }
    }

    @Test
    fun `unknown connection id throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), type = ConnectionType.STREET)
        }
    }

    @Test
    fun `unknown map id throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), c1Id, type = ConnectionType.STREET)
        }
    }

    @Test
    fun `no changes preserves all existing values`() {
        useCase.execute(state.id, c1Id, type = ConnectionType.STREET, name = "Road", description = "Main road")
        val saved = mapStatePort.findById(state.id)!!
        val result = useCase.execute(saved.id, c1Id)
        val conn = result.connections[c1Id]!!
        assertEquals(ConnectionType.STREET, conn.type)
        assertEquals("Road", conn.name)
        assertEquals("Main road", conn.description)
    }
}
