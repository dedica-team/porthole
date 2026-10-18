package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.collaboration.RemoveCollaboratorUseCase
import team.dedica.porthole.application.session.greenkeeping.RemoveCollaboratorFromGreenkeepingRotationsUseCase
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState

class RemoveCollaboratorUseCaseTest {

    private val adminId = UUID.nameUUIDFromBytes("admin".toByteArray())
    private val collaboratorId = UUID.nameUUIDFromBytes("p1".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: RemoveCollaboratorUseCase
    private lateinit var state: SessionState

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        state.collaborators.add(Collaborator(id = collaboratorId, username = "Alice"))
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        authorizationPort.makeAdmin(adminId)
        useCase = RemoveCollaboratorUseCase(
            mapStatePort,
            NoOpBroadcastPort(),
            authorizationPort,
            RemoveCollaboratorFromGreenkeepingRotationsUseCase(),
        )
    }

    @Test
    fun `admin can remove a collaborator`() {
        val result = useCase.execute(state.id, adminId, collaboratorId)
        assertFalse(result.collaborators.any { it.id == collaboratorId })
    }

    @Test
    fun `removing non-existent collaborator throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, adminId, UUID.randomUUID())
        }
    }

    @Test
    fun `non-admin throws AccessDeniedException`() {
        assertThrows(team.dedica.porthole.domain.AccessDeniedException::class.java) {
            useCase.execute(state.id, collaboratorId, collaboratorId)
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), adminId, collaboratorId)
        }
    }
}

