package team.dedica.porthole.application

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

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "p1", username = "Alice"))
        state.landmarks["t1"] = Landmark(id = "t1", name = "Tower One", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        state.landmarks["t2"] = Landmark(id = "t2", name = "Tower Two", ownerId = "p1", coordinate = HexCoordinate(3, 0))
        state.connections["c1"] = Connection(
            id = "c1",
            originId = "t1",
            targetId = "t2",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(3, 0)),
            type = ConnectionType.PIPE,
        )
        state.connections["c2"] = Connection(
            id = "c2",
            originId = "t1",
            targetId = "t2",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(2, 0), HexCoordinate(3, 0)),
            type = ConnectionType.TELEGRAPH,
        )
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }
        useCase = RemoveConnectionUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `removes the specified connection`() {
        val result = useCase.execute(state.id, "c1")
        assertFalse(result.connections.containsKey("c1"))
    }

    @Test
    fun `leaves other connections intact`() {
        val result = useCase.execute(state.id, "c1")
        assertTrue(result.connections.containsKey("c2"))
    }

    @Test
    fun `persists the removal`() {
        useCase.execute(state.id, "c1")
        val persisted = mapStatePort.findById(state.id)!!
        assertFalse(persisted.connections.containsKey("c1"))
    }

    @Test
    fun `unknown connection id throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "no-such-connection")
        }
    }

    @Test
    fun `unknown map id throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-such-map", "c1")
        }
    }
}

