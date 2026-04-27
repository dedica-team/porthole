package team.dedica.porthole.application

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

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "p1", username = "Alice"))
        state.landmarks["t1"] =
            Landmark(id = "t1", name = "Tower One", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        state.landmarks["t2"] =
            Landmark(id = "t2", name = "Tower Two", ownerId = "p1", coordinate = HexCoordinate(3, 0))
        state.connections["c1"] = Connection(
            id = "c1",
            originId = "t1",
            targetId = "t2",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(3, 0)),
            type = ConnectionType.PIPE,
        )
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }
        useCase = EditConnectionUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `change type from PIPE to TELEGRAPH`() {
        val result = useCase.execute(state.id, "c1", type = ConnectionType.TELEGRAPH)
        assertEquals(ConnectionType.TELEGRAPH, result.connections["c1"]!!.type)
    }

    @Test
    fun `set name on connection`() {
        val result = useCase.execute(state.id, "c1", name = "Supply Line")
        assertEquals("Supply Line", result.connections["c1"]!!.name)
    }

    @Test
    fun `clear name via clearName flag`() {
        useCase.execute(state.id, "c1", name = "Supply Line")
        val saved = mapStatePort.findById(state.id)!!
        val result = useCase.execute(saved.id, "c1", clearName = true)
        assertNull(result.connections["c1"]!!.name)
    }

    @Test
    fun `set and clear description`() {
        val withDesc = useCase.execute(state.id, "c1", description = "Important route")
        assertEquals("Important route", withDesc.connections["c1"]!!.description)

        val saved = mapStatePort.findById(state.id)!!
        val cleared = useCase.execute(saved.id, "c1", clearDescription = true)
        assertNull(cleared.connections["c1"]!!.description)
    }

    @Test
    fun `blank name throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "c1", name = "   ")
        }
    }

    @Test
    fun `blank description throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "c1", description = "  ")
        }
    }

    @Test
    fun `unknown connection id throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "non-existing", type = ConnectionType.STREET)
        }
    }

    @Test
    fun `unknown map id throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-map", "c1", type = ConnectionType.STREET)
        }
    }

    @Test
    fun `no changes preserves all existing values`() {
        useCase.execute(state.id, "c1", type = ConnectionType.STREET, name = "Road", description = "Main road")
        val saved = mapStatePort.findById(state.id)!!
        val result = useCase.execute(saved.id, "c1")
        val conn = result.connections["c1"]!!
        assertEquals(ConnectionType.STREET, conn.type)
        assertEquals("Road", conn.name)
        assertEquals("Main road", conn.description)
    }
}

