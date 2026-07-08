package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.security.access.AccessDeniedException
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.RemoveChoreListUseCase
import team.dedica.porthole.domain.*

class RemoveChoreListUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var listId: UUID
    private lateinit var useCase: RemoveChoreListUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice"))
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        val broadcast = NoOpBroadcastPort()
        listId = CreateChoreListUseCase(mapStatePort, broadcast, authorizationPort)
            .execute(state.id, "My List", emptyList(), null, null, collaborator.id)[0].id
        useCase = RemoveChoreListUseCase(mapStatePort, broadcast, authorizationPort)
    }

    @Test
    fun `removes the chore list`() {
        useCase.execute(state.id, listId, collaborator.id)
        val saved = mapStatePort.findById(state.id)!!
        assertFalse(saved.choreLists.containsKey(listId))
    }

    @Test
    fun `unknown list throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), collaborator.id)
        }
    }

    @Test
    fun `non-collaborator throws AccessDeniedException`() {
        assertThrows(AccessDeniedException::class.java) {
            useCase.execute(state.id, listId, collaborator2.id)
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), listId, collaborator.id)
        }
    }
}

