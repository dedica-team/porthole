package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.RemoveChoreListUseCase
import team.dedica.porthole.domain.*

class RemoveChoreListUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var listId: String
    private lateinit var useCase: RemoveChoreListUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "u1", username = "Alice"))
        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        userPort = InMemoryTestUserRepository().also { it.save(UserRecord("u1", "Alice", "gh-1")) }
        val broadcast = NoOpBroadcastPort()
        listId = CreateChoreListUseCase(mapStatePort, userPort, broadcast)
            .execute(state.id, "My List", emptyList(), null, "Alice")[0].id
        useCase = RemoveChoreListUseCase(mapStatePort, userPort, broadcast)
    }

    @Test
    fun `removes the chore list`() {
        useCase.execute(state.id, listId, "Alice")
        val saved = mapStatePort.findById(state.id)!!
        assertFalse(saved.choreLists.containsKey(listId))
    }

    @Test
    fun `unknown list throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "no-list", "Alice")
        }
    }

    @Test
    fun `non-collaborator throws IllegalArgumentException`() {
        userPort.save(UserRecord("u2", "Bob", "gh-2"))
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, listId, "Bob")
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-map", listId, "Alice")
        }
    }
}

