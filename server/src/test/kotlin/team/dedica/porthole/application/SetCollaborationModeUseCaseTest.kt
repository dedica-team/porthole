package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.collaboration.SetCollaborationModeUseCase
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState

class SetCollaborationModeUseCaseTest {

    private val collaboratorId = UUID.nameUUIDFromBytes("p1".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: SetCollaborationModeUseCase
    private lateinit var state: SessionState

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        state.collaborators.add(Collaborator(id = collaboratorId, username = "Alice"))
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = SetCollaborationModeUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `collaborator can set mode to REQUEST`() {
        val result = useCase.execute(state.id, collaboratorId, CollaborationMode.REQUEST)
        assertEquals(CollaborationMode.REQUEST, result.collaborationMode)
    }

    @Test
    fun `collaborator can set mode to PRIVATE`() {
        val result = useCase.execute(state.id, collaboratorId, CollaborationMode.PRIVATE)
        assertEquals(CollaborationMode.PRIVATE, result.collaborationMode)
    }

    @Test
    fun `collaborator can set mode to OPEN`() {
        val result = useCase.execute(state.id, collaboratorId, CollaborationMode.OPEN)
        assertEquals(CollaborationMode.OPEN, result.collaborationMode)
    }

    @Test
    fun `non-collaborator throws AccessDeniedException`() {
        assertThrows(team.dedica.porthole.domain.AccessDeniedException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), CollaborationMode.OPEN)
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaboratorId, CollaborationMode.OPEN)
        }
    }

    @Test
    fun `change is persisted`() {
        useCase.execute(state.id, collaboratorId, CollaborationMode.REQUEST)
        assertEquals(CollaborationMode.REQUEST, mapStatePort.findById(state.id)!!.collaborationMode)
    }
}

