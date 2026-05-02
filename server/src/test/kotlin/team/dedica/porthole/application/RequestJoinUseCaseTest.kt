package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.lobby.RequestJoinUseCase
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState

class RequestJoinUseCaseTest {

    private val userId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: RequestJoinUseCase
    private lateinit var state: SessionState

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        userPort = InMemoryTestUserRepository()
        userPort.save(UserRecord(id = userId, username = "alice", githubId = "gh-1"))
        state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }),
            collaborationMode = CollaborationMode.REQUEST)
        mapStatePort.save(state)
        useCase = RequestJoinUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `adds a join request`() {
        val result = useCase.execute(state.id, userId)
        assertTrue(result.joinRequests.any { it.userId == userId })
    }

    @Test
    fun `open map throws IllegalArgumentException`() {
        val openState = SessionState(
            map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }),
            collaborationMode = CollaborationMode.OPEN
        )
        mapStatePort.save(openState)
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(openState.id, userId)
        }
    }

    @Test
    fun `already a collaborator throws IllegalArgumentException`() {
        state.collaborators.add(Collaborator(id = userId, username = "alice"))
        mapStatePort.save(state)
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, userId)
        }
    }

    @Test
    fun `duplicate request throws IllegalArgumentException`() {
        useCase.execute(state.id, userId)
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, userId)
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), userId)
        }
    }

    @Test
    fun `unknown user throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID())
        }
    }
}
