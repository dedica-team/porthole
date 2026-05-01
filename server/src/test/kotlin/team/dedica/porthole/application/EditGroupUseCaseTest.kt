package team.dedica.porthole.application
import java.util.UUID

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

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private val g1Id = UUID.nameUUIDFromBytes("g1".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(collaborator)
        state.groups[g1Id] = LandmarkGroup(id = g1Id, name = "Alpha", color = "#ff0000")
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
        }
        useCase = EditGroupUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `can update name`() {
        val result = useCase.execute(state.id, "Alice", g1Id, "Beta", null)
        assertEquals("Beta", result.groups[g1Id]!!.name)
        assertEquals("#ff0000", result.groups[g1Id]!!.color)
    }

    @Test
    fun `can update color`() {
        val result = useCase.execute(state.id, "Alice", g1Id, null, "#00ff00")
        assertEquals("Alpha", result.groups[g1Id]!!.name)
        assertEquals("#00ff00", result.groups[g1Id]!!.color)
    }

    @Test
    fun `can update both name and color`() {
        val result = useCase.execute(state.id, "Alice", g1Id, "Gamma", "#0000ff")
        assertEquals("Gamma", result.groups[g1Id]!!.name)
        assertEquals("#0000ff", result.groups[g1Id]!!.color)
    }

    @Test
    fun `null values leave fields unchanged`() {
        val result = useCase.execute(state.id, "Alice", g1Id, null, null)
        assertEquals("Alpha", result.groups[g1Id]!!.name)
        assertEquals("#ff0000", result.groups[g1Id]!!.color)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", g1Id, "   ", null)
        }
    }

    @Test
    fun `invalid color fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", g1Id, null, "blue")
        }
    }

    @Test
    fun `unknown group id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Alice", UUID.randomUUID(), "X", null)
        }
    }

    @Test
    fun `non-collaborator cannot edit group`() {
        val otherPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p2".toByteArray()), "Bob", "gh-2"))
        }
        val uc = EditGroupUseCase(mapStatePort, otherPort, NoOpBroadcastPort())
        assertThrows(IllegalArgumentException::class.java) {
            uc.execute(state.id, "Bob", g1Id, "Hacked", null)
        }
    }
}
