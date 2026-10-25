package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.domain.AccessDeniedException
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.ToggleChoreListCompletedUseCase
import team.dedica.porthole.domain.*

class ToggleChoreListCompletedUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var listId: UUID
    private lateinit var useCase: ToggleChoreListCompletedUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice"))
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        val broadcast = NoOpBroadcastPort()
        listId = CreateChoreListUseCase(mapStatePort, broadcast, authorizationPort)
            .execute(state.id, "Checklist", emptyList(), null, null, collaborator.id)[0].id
        useCase = ToggleChoreListCompletedUseCase(mapStatePort, broadcast, authorizationPort)
    }

    @Test
    fun `toggles completed from false to true`() {
        val result = useCase.execute(state.id, listId, collaborator.id)
        assertTrue(result.completed)
    }

    @Test
    fun `toggles completed from true back to false`() {
        useCase.execute(state.id, listId, collaborator.id)
        val result = useCase.execute(state.id, listId, collaborator.id)
        assertFalse(result.completed)
    }

    @Test
    fun `persists the toggled value`() {
        useCase.execute(state.id, listId, collaborator.id)
        val saved = mapStatePort.findById(state.id)!!.choreLists[listId]!!
        assertTrue(saved.completed)
    }

    @Test
    fun `unknown list throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), collaborator.id)
        }
    }

    @Test
    fun `non-collaborator throws AccessDeniedException`() {
        assertThrows(AccessDeniedException::class.java) {
            useCase.execute(state.id, listId, collaborator2.id)
        }
    }
}

