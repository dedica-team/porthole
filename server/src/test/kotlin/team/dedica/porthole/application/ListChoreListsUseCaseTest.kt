package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.ListChoreListsUseCase
import team.dedica.porthole.domain.*

class ListChoreListsUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: ListChoreListsUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "u1", username = "Alice"))
        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("u1", "Alice", "gh-1"))
            it.save(UserRecord("u2", "Bob", "gh-2"))   // viewer – not a collaborator
        }
        val broadcast = NoOpBroadcastPort()
        val create = CreateChoreListUseCase(mapStatePort, userPort, broadcast)
        create.execute(state.id, "Zebra", emptyList(), null, "Alice")
        create.execute(state.id, "Alpha", emptyList(), null, "Alice")
        useCase = ListChoreListsUseCase(mapStatePort, userPort)
    }

    @Test
    fun `returns all lists sorted by title`() {
        val result = useCase.execute(state.id, "Alice")
        assertEquals(2, result.size)
        assertEquals("Alpha", result[0].title)
        assertEquals("Zebra", result[1].title)
    }

    @Test
    fun `viewer (non-collaborator) can list chore lists`() {
        // Bob is not a collaborator but should still be able to list
        val result = useCase.execute(state.id, "Bob")
        assertEquals(2, result.size)
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-map", "Alice")
        }
    }

    @Test
    fun `unknown user throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "no-user")
        }
    }
}

