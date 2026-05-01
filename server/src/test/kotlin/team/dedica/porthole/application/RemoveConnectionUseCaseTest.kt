package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.landscaping.RemoveConnectionUseCase
import team.dedica.porthole.domain.*

class RemoveConnectionUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: RemoveConnectionUseCase

    private val t1Id = UUID.nameUUIDFromBytes("t1".toByteArray())
    private val t2Id = UUID.nameUUIDFromBytes("t2".toByteArray())
    private val c1Id = UUID.nameUUIDFromBytes("c1".toByteArray())
    private val c2Id = UUID.nameUUIDFromBytes("c2".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        state.landmarks[t1Id] = Landmark(id = t1Id, name = "Tower One", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(0, 0))
        state.landmarks[t2Id] = Landmark(id = t2Id, name = "Tower Two", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(3, 0))
        state.connections[c1Id] = Connection(
            id = c1Id, originId = t1Id, targetId = t2Id,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(3, 0)),
            type = ConnectionType.PIPE,
        )
        state.connections[c2Id] = Connection(
            id = c2Id, originId = t1Id, targetId = t2Id,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(2, 0), HexCoordinate(3, 0)),
            type = ConnectionType.TELEGRAPH,
        )
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
        }
        useCase = RemoveConnectionUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `removes the specified connection`() {
        val result = useCase.execute(state.id, c1Id)
        assertFalse(result.connections.containsKey(c1Id))
    }

    @Test
    fun `leaves other connections intact`() {
        val result = useCase.execute(state.id, c1Id)
        assertTrue(result.connections.containsKey(c2Id))
    }

    @Test
    fun `persists the removal`() {
        useCase.execute(state.id, c1Id)
        val persisted = mapStatePort.findById(state.id)!!
        assertFalse(persisted.connections.containsKey(c1Id))
    }

    @Test
    fun `unknown connection id throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, UUID.randomUUID())
        }
    }

    @Test
    fun `unknown map id throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), c1Id)
        }
    }
}
