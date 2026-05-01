package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.ToggleChoreListCompletedUseCase
import team.dedica.porthole.domain.*

class ToggleChoreListCompletedUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var listId: UUID
    private lateinit var useCase: ToggleChoreListCompletedUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice"))
        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        userPort = InMemoryTestUserRepository().also { it.save(UserRecord(UUID.nameUUIDFromBytes("u1".toByteArray()), "Alice", "gh-1")) }
        val broadcast = NoOpBroadcastPort()
        listId = CreateChoreListUseCase(mapStatePort, userPort, broadcast)
            .execute(state.id, "Checklist", emptyList(), null, "Alice")[0].id
        useCase = ToggleChoreListCompletedUseCase(mapStatePort, userPort, broadcast)
    }

    @Test
    fun `toggles completed from false to true`() {
        val result = useCase.execute(state.id, listId, "Alice")
        assertTrue(result.completed)
    }

    @Test
    fun `toggles completed from true back to false`() {
        useCase.execute(state.id, listId, "Alice")
        val result = useCase.execute(state.id, listId, "Alice")
        assertFalse(result.completed)
    }

    @Test
    fun `persists the toggled value`() {
        useCase.execute(state.id, listId, "Alice")
        val saved = mapStatePort.findById(state.id)!!.choreLists[listId]!!
        assertTrue(saved.completed)
    }

    @Test
    fun `unknown list throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), "Alice")
        }
    }

    @Test
    fun `non-collaborator throws IllegalArgumentException`() {
        userPort.save(UserRecord(UUID.nameUUIDFromBytes("u2".toByteArray()), "Bob", "gh-2"))
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, listId, "Bob")
        }
    }
}

