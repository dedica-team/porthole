package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.security.access.AccessDeniedException
import team.dedica.porthole.application.session.metrics.CreateGroupUseCase
import team.dedica.porthole.domain.*

class CreateGroupUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: CreateGroupUseCase

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(collaborator)
        mapStatePort = InMemorySessionStatePort()
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = CreateGroupUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `creates group with valid name and color`() {
        val result = useCase.execute(state.id, collaborator.id, "Alpha Squad", "#e74c3c")
        assertEquals(1, result.groups.size)
        val group = result.groups.values.first()
        assertEquals("Alpha Squad", group.name)
        assertEquals("#e74c3c", group.color)
        assertNotNull(group.id)
    }

    @Test
    fun `group id is a UUID`() {
        val result = useCase.execute(state.id, collaborator.id, "Beta", "#0000ff")
        val id = result.groups.values.first().id
        assertNotNull(id) // id is already a UUID
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, "   ", "#ff0000")
        }
    }

    @Test
    fun `invalid color fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, "Gamma", "red")
        }
    }

    @Test
    fun `invalid color without hash fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, "Delta", "ff0000")
        }
    }

    @Test
    fun `unknown map id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaborator.id, "Epsilon", "#ffffff")
        }
    }

    @Test
    fun `non-collaborator cannot create group`() {
        val uc = CreateGroupUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        assertThrows(AccessDeniedException::class.java) {
            uc.execute(state.id, collaborator2.id, "Intruder Group", "#123456")
        }
    }

    @Test
    fun `multiple groups can coexist`() {
        useCase.execute(state.id, collaborator.id, "Group A", "#ff0000")
        val result = useCase.execute(state.id, collaborator.id, "Group B", "#00ff00")
        assertEquals(2, result.groups.size)
    }
}
