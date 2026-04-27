package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.metrics.EditGroupUseCase
import team.dedica.porthole.domain.*

class EditGroupUseCaseTest {
    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: EditGroupUseCase

    private val collaborator = Collaborator(id = "p1", username = "Alice")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(collaborator)
        state.groups["g1"] = LandmarkGroup(id = "g1", name = "Alpha", color = "#ff0000")
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }
        useCase = EditGroupUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `can update name`() {
        val result = useCase.execute(state.id, "Alice", "g1", "Beta", null)
        assertEquals("Beta", result.groups["g1"]!!.name)
        assertEquals("#ff0000", result.groups["g1"]!!.color)
    }

    @Test
    fun `can update color`() {
        val result = useCase.execute(state.id, "Alice", "g1", null, "#00ff00")
        assertEquals("Alpha", result.groups["g1"]!!.name)
        assertEquals("#00ff00", result.groups["g1"]!!.color)
    }

    @Test
    fun `can update both name and color`() {
        val result = useCase.execute(state.id, "Alice", "g1", "Gamma", "#0000ff")
        assertEquals("Gamma", result.groups["g1"]!!.name)
        assertEquals("#0000ff", result.groups["g1"]!!.color)
    }

    @Test
    fun `null values leave fields unchanged`() {
        val result = useCase.execute(state.id, "Alice", "g1", null, null)
        assertEquals("Alpha", result.groups["g1"]!!.name)
        assertEquals("#ff0000", result.groups["g1"]!!.color)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "g1", "   ", null)
        }
    }

    @Test
    fun `invalid color fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "g1", null, "blue")
        }
    }

    @Test
    fun `unknown group id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Alice", "no-group", "X", null)
        }
    }

    @Test
    fun `non-collaborator cannot edit group`() {
        val otherPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p2", "Bob", "gh-2"))
        }
        val uc = EditGroupUseCase(mapStatePort, otherPort, NoOpBroadcastPort())
        assertThrows(IllegalArgumentException::class.java) {
            uc.execute(state.id, "Bob", "g1", "Hacked", null)
        }
    }
}
