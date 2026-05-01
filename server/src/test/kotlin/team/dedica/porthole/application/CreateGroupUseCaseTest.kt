package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.metrics.CreateGroupUseCase
import team.dedica.porthole.domain.*

class CreateGroupUseCaseTest {
    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: CreateGroupUseCase

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(collaborator)
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
        }
        useCase = CreateGroupUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `creates group with valid name and color`() {
        val result = useCase.execute(state.id, "Alice", "Alpha Squad", "#e74c3c")
        assertEquals(1, result.groups.size)
        val group = result.groups.values.first()
        assertEquals("Alpha Squad", group.name)
        assertEquals("#e74c3c", group.color)
        assertNotNull(group.id)
    }

    @Test
    fun `group id is a UUID`() {
        val result = useCase.execute(state.id, "Alice", "Beta", "#0000ff")
        val id = result.groups.values.first().id
        assertNotNull(id) // id is already a UUID
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "   ", "#ff0000")
        }
    }

    @Test
    fun `invalid color fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "Gamma", "red")
        }
    }

    @Test
    fun `invalid color without hash fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "Delta", "ff0000")
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), "Alice", "Epsilon", "#ffffff")
        }
    }

    @Test
    fun `non-collaborator cannot create group`() {
        val otherPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p2".toByteArray()), "Bob", "gh-2"))
        }
        val uc = CreateGroupUseCase(mapStatePort, otherPort, NoOpBroadcastPort())
        assertThrows(IllegalArgumentException::class.java) {
            uc.execute(state.id, "Bob", "Intruder Group", "#123456")
        }
    }

    @Test
    fun `multiple groups can coexist`() {
        useCase.execute(state.id, "Alice", "Group A", "#ff0000")
        val result = useCase.execute(state.id, "Alice", "Group B", "#00ff00")
        assertEquals(2, result.groups.size)
    }
}
