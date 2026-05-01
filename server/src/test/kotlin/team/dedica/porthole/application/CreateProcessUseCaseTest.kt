package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.processes.CreateProcessUseCase
import team.dedica.porthole.domain.*

class CreateProcessUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: CreateProcessUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        userPort = InMemoryTestUserRepository().also { it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1")) }
        useCase = CreateProcessUseCase(mapStatePort, userPort)
    }

    @Test
    fun `creates a process and returns updated list`() {
        val result = useCase.execute(state.id, "Deploy Pipeline", null, "Alice")
        assertEquals(1, result.size)
        assertEquals("Deploy Pipeline", result[0].name)
    }

    @Test
    fun `creates process with description`() {
        val result = useCase.execute(state.id, "Intake", "Initial onboarding", "Alice")
        assertEquals("Initial onboarding", result[0].description)
    }

    @Test
    fun `persists the new process`() {
        useCase.execute(state.id, "Flow", null, "Alice")
        val saved = mapStatePort.findById(state.id)!!
        assertEquals(1, saved.processes.size)
    }

    @Test
    fun `blank name throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "   ", null, "Alice")
        }
    }

    @Test
    fun `non-collaborator throws IllegalArgumentException`() {
        userPort.save(UserRecord(UUID.nameUUIDFromBytes("p2".toByteArray()), "Bob", "gh-2"))
        // Bob is not a collaborator on state
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Spy Flow", null, "Bob")
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), "Flow", null, "Alice")
        }
    }

    @Test
    fun `returned list is sorted by name`() {
        useCase.execute(state.id, "Zebra", null, "Alice")
        val result = useCase.execute(state.id, "Alpha", null, "Alice")
        assertEquals("Alpha", result[0].name)
        assertEquals("Zebra", result[1].name)
    }
}

