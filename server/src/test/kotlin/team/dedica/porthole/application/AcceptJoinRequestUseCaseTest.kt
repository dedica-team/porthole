package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.collaboration.AcceptJoinRequestUseCase
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.JoinRequest
import team.dedica.porthole.domain.SessionState

class AcceptJoinRequestUseCaseTest {

    private val acceptorId = UUID.nameUUIDFromBytes("p1".toByteArray())
    private val requesterId = UUID.nameUUIDFromBytes("p2".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: AcceptJoinRequestUseCase
    private lateinit var state: SessionState
    private lateinit var requestId: UUID

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        userPort = InMemoryTestUserRepository()
        state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        state.collaborators.add(Collaborator(id = acceptorId, username = "Alice"))
        val request = JoinRequest(userId = requesterId, username = "Bob")
        state.joinRequests.add(request)
        requestId = request.id
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = AcceptJoinRequestUseCase(mapStatePort, userPort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `accepted requester becomes collaborator`() {
        val result = useCase.execute(state.id, acceptorId, requestId)
        assertTrue(result.collaborators.any { it.id == requesterId })
    }

    @Test
    fun `join request is removed after acceptance`() {
        val result = useCase.execute(state.id, acceptorId, requestId)
        assertTrue(result.joinRequests.none { it.id == requestId })
    }

    @Test
    fun `unknown request throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, acceptorId, UUID.randomUUID())
        }
    }

    @Test
    fun `non-collaborator acceptor throws AccessDeniedException`() {
        assertThrows(team.dedica.porthole.domain.AccessDeniedException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), requestId)
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), acceptorId, requestId)
        }
    }
}

