package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.ListChoreListsUseCase
import team.dedica.porthole.domain.*

class ListChoreListsUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: ListChoreListsUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice"))
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        val broadcast = NoOpBroadcastPort()
        val create = CreateChoreListUseCase(mapStatePort, broadcast, authorizationPort)
        create.execute(state.id, "Zebra", emptyList(), null, collaborator.id)
        create.execute(state.id, "Alpha", emptyList(), null, collaborator.id)
        useCase = ListChoreListsUseCase(authorizationPort)
    }

    @Test
    fun `returns all lists sorted by title`() {
        val result = useCase.execute(state.id, collaborator.id)
        assertEquals(2, result.size)
        assertEquals("Alpha", result[0].title)
        assertEquals("Zebra", result[1].title)
    }

    @Test
    fun `viewer (non-collaborator) can list chore lists`() {
        // Bob is not a collaborator but should still be able to list
        val result = useCase.execute(state.id, collaborator2.id)
        assertEquals(2, result.size)
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaborator.id)
        }
    }

    @Test
    fun `non-collaborator sees empty list`() {
        assertDoesNotThrow {
            useCase.execute(state.id, UUID.randomUUID())
        }
    }
}

