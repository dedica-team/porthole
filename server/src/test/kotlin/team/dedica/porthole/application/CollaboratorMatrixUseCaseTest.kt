package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.metrics.SetMatrixEntryUseCase
import team.dedica.porthole.application.session.metrics.ClearMatrixEntryUseCase
import team.dedica.porthole.application.session.metrics.GetCollaboratorMatrixUseCase
import team.dedica.porthole.application.session.metrics.EditCollaboratorMatrixUseCase
import team.dedica.porthole.domain.*

class CollaboratorMatrixUseCaseTest {

    private val callerId = UUID.nameUUIDFromBytes("p1".toByteArray())
    private val targetId = UUID.nameUUIDFromBytes("p2".toByteArray())
    private val landmarkId = UUID.nameUUIDFromBytes("lm1".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var state: SessionState

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        state = SessionState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))
        state.collaborators.add(Collaborator(id = callerId, username = "Alice"))
        state.collaborators.add(Collaborator(id = targetId, username = "Bob"))
        val landmark = Landmark(id = landmarkId, ownerId = callerId, coordinate = HexCoordinate(0, 0))
        state.landmarks[landmarkId] = landmark
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
    }

    // ── SetMatrixEntryUseCase ─────────────────────────────────────────────────

    @Test
    fun `set matrix entry stores the level`() {
        val useCase = SetMatrixEntryUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        val result = useCase.execute(state.id, callerId, landmarkId, targetId, MatrixLevel.HIGH)
        assertEquals(MatrixLevel.HIGH, result.collaboratorMatrix.entries[landmarkId]!![targetId]!!.level)
    }

    @Test
    fun `set matrix entry for unknown landmark throws IllegalArgumentException`() {
        val useCase = SetMatrixEntryUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, callerId, UUID.randomUUID(), targetId, MatrixLevel.HIGH)
        }
    }

    @Test
    fun `set matrix entry for unknown collaborator throws IllegalArgumentException`() {
        val useCase = SetMatrixEntryUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, callerId, landmarkId, UUID.randomUUID(), MatrixLevel.HIGH)
        }
    }

    @Test
    fun `set matrix entry non-collaborator throws AccessDeniedException`() {
        val useCase = SetMatrixEntryUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), landmarkId, targetId, MatrixLevel.HIGH)
        }
    }

    // ── ClearMatrixEntryUseCase ───────────────────────────────────────────────

    @Test
    fun `clear matrix entry removes the level`() {
        val setUseCase = SetMatrixEntryUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        setUseCase.execute(state.id, callerId, landmarkId, targetId, MatrixLevel.HIGH)

        val clearUseCase = ClearMatrixEntryUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        val result = clearUseCase.execute(state.id, callerId, landmarkId, targetId)
        assertNull(result.collaboratorMatrix.entries[landmarkId]?.get(targetId))
    }

    @Test
    fun `clear matrix entry is idempotent when no entry exists`() {
        val useCase = ClearMatrixEntryUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        assertDoesNotThrow { useCase.execute(state.id, callerId, landmarkId, targetId) }
    }

    // ── GetCollaboratorMatrixUseCase ──────────────────────────────────────────

    @Test
    fun `get collaborator matrix returns the matrix`() {
        val useCase = GetCollaboratorMatrixUseCase(authorizationPort)
        val result = useCase.execute(state.id, callerId)
        assertNotNull(result)
    }

    @Test
    fun `get collaborator matrix unknown map throws NoSuchElementException`() {
        val useCase = GetCollaboratorMatrixUseCase(authorizationPort)
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), callerId)
        }
    }

    // ── EditCollaboratorMatrixUseCase ─────────────────────────────────────────

    @Test
    fun `edit matrix name updates collaboratorMatrix name`() {
        val useCase = EditCollaboratorMatrixUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        val result = useCase.execute(state.id, callerId, "New Name")
        assertEquals("New Name", result.collaboratorMatrix.name)
    }

    @Test
    fun `edit matrix name with blank string throws IllegalArgumentException`() {
        val useCase = EditCollaboratorMatrixUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, callerId, "   ")
        }
    }

    @Test
    fun `edit matrix name non-collaborator throws AccessDeniedException`() {
        val useCase = EditCollaboratorMatrixUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), "Name")
        }
    }
}

