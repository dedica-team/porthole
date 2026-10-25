package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.collaboration.DeclineJoinRequestUseCase
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.JoinRequest
import team.dedica.porthole.domain.SessionState

class DeclineJoinRequestUseCaseTest {

    private val acceptorId = UUID.nameUUIDFromBytes("p1".toByteArray())
    private val requesterId = UUID.nameUUIDFromBytes("p2".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: DeclineJoinRequestUseCase
    private lateinit var state: SessionState
    private lateinit var requestId: UUID

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        state.collaborators.add(Collaborator(id = acceptorId, username = "Alice"))
        val request = JoinRequest(userId = requesterId, username = "Bob")
        state.joinRequests.add(request)
        requestId = request.id
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = DeclineJoinRequestUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `declined request is removed`() {
        val result = useCase.execute(state.id, acceptorId, requestId)
        assertTrue(result.joinRequests.none { it.id == requestId })
    }

    @Test
    fun `requester is not added as collaborator`() {
        val result = useCase.execute(state.id, acceptorId, requestId)
        assertFalse(result.collaborators.any { it.id == requesterId })
    }

    @Test
    fun `unknown request throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, acceptorId, UUID.randomUUID())
        }
    }

    @Test
    fun `non-collaborator throws AccessDeniedException`() {
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

