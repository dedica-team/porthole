package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.domain.AccessDeniedException
import team.dedica.porthole.application.session.metrics.EditGroupUseCase
import team.dedica.porthole.domain.*

class EditGroupUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: EditGroupUseCase

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private val g1Id = UUID.nameUUIDFromBytes("g1".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(collaborator)
        state.groups[g1Id] = LandmarkGroup(id = g1Id, name = "Alpha", color = "#ff0000")
        mapStatePort = InMemorySessionStatePort()
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = EditGroupUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `can update name`() {
        val result = useCase.execute(state.id, collaborator.id, g1Id, "Beta", null)
        assertEquals("Beta", result.groups[g1Id]!!.name)
        assertEquals("#ff0000", result.groups[g1Id]!!.color)
    }

    @Test
    fun `can update color`() {
        val result = useCase.execute(state.id, collaborator.id, g1Id, null, "#00ff00")
        assertEquals("Alpha", result.groups[g1Id]!!.name)
        assertEquals("#00ff00", result.groups[g1Id]!!.color)
    }

    @Test
    fun `can update both name and color`() {
        val result = useCase.execute(state.id, collaborator.id, g1Id, "Gamma", "#0000ff")
        assertEquals("Gamma", result.groups[g1Id]!!.name)
        assertEquals("#0000ff", result.groups[g1Id]!!.color)
    }

    @Test
    fun `null values leave fields unchanged`() {
        val result = useCase.execute(state.id, collaborator.id, g1Id, null, null)
        assertEquals("Alpha", result.groups[g1Id]!!.name)
        assertEquals("#ff0000", result.groups[g1Id]!!.color)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, g1Id, "   ", null)
        }
    }

    @Test
    fun `invalid color fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, g1Id, null, "blue")
        }
    }

    @Test
    fun `unknown group id fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, collaborator.id, UUID.randomUUID(), "X", null)
        }
    }

    @Test
    fun `non-collaborator cannot edit group`() {
        val uc = EditGroupUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        assertThrows(AccessDeniedException::class.java) {
            uc.execute(state.id, collaborator2.id, g1Id, "Hacked", null)
        }
    }
}
