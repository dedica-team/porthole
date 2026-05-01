package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.processes.CreateProcessUseCase
import team.dedica.porthole.domain.*

class CreateProcessUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: CreateProcessUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = CreateProcessUseCase(mapStatePort, authorizationPort)
    }

    @Test
    fun `creates a process and returns updated list`() {
        val result = useCase.execute(state.id, "Deploy Pipeline", null, collaborator.id)
        assertEquals(1, result.size)
        assertEquals("Deploy Pipeline", result[0].name)
    }

    @Test
    fun `creates process with description`() {
        val result = useCase.execute(state.id, "Intake", "Initial onboarding", collaborator.id)
        assertEquals("Initial onboarding", result[0].description)
    }

    @Test
    fun `persists the new process`() {
        useCase.execute(state.id, "Flow", null, collaborator.id)
        val saved = mapStatePort.findById(state.id)!!
        assertEquals(1, saved.processes.size)
    }

    @Test
    fun `blank name throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "   ", null, collaborator.id)
        }
    }

    @Test
    fun `non-collaborator throws AccessDeniedException`() {
        // Bob is not a collaborator on state
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) {
            useCase.execute(state.id, "Spy Flow", null, collaborator2.id)
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), "Flow", null, collaborator.id)
        }
    }

    @Test
    fun `returned list is sorted by name`() {
        useCase.execute(state.id, "Zebra", null, collaborator.id)
        val result = useCase.execute(state.id, "Alpha", null, collaborator.id)
        assertEquals("Alpha", result[0].name)
        assertEquals("Zebra", result[1].name)
    }
}

