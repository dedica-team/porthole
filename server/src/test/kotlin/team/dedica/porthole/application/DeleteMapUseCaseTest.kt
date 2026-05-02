package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.lobby.DeleteMapUseCase
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.SessionRole

class DeleteMapUseCaseTest {

    private val adminId = UUID.nameUUIDFromBytes("admin".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: DeleteMapUseCase
    private lateinit var state: SessionState

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        state.collaborators.add(Collaborator(id = adminId, username = "admin"))
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        authorizationPort.makeAdmin(adminId)
        useCase = DeleteMapUseCase(mapStatePort, authorizationPort)
    }

    @Test
    fun `admin can delete a map`() {
        useCase.execute(state.id, adminId)
        assertNull(mapStatePort.findById(state.id))
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

