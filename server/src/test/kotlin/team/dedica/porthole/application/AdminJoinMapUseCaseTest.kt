package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.lobby.AdminJoinMapUseCase
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState

class AdminJoinMapUseCaseTest {

    private val adminId = UUID.nameUUIDFromBytes("admin".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: AdminJoinMapUseCase
    private lateinit var state: SessionState

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        userPort = InMemoryTestUserRepository()
        userPort.save(UserRecord(id = adminId, username = "admin", githubId = "gh-admin"))
        state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        authorizationPort.makeAdmin(adminId)
        useCase = AdminJoinMapUseCase(mapStatePort, userPort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `admin joins map and is added as collaborator`() {
        val result = useCase.execute(state.id, adminId)
        assertTrue(result.collaborators.any { it.id == adminId })
    }

    @Test
    fun `admin joining twice is idempotent`() {
        useCase.execute(state.id, adminId)
        val result = useCase.execute(state.id, adminId)
        assertEquals(1, result.collaborators.count { it.id == adminId })
    }

    @Test
    fun `non-admin throws AccessDeniedException`() {
        val otherId = UUID.randomUUID()
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) {
            useCase.execute(state.id, otherId)
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), adminId)
        }
    }
}

