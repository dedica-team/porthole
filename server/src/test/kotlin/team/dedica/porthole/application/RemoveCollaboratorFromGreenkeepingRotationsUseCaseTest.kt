package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.greenkeeping.RemoveCollaboratorFromGreenkeepingRotationsUseCase
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.GreenkeepingRotationCollaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState
import java.time.Instant
import java.util.UUID

class RemoveCollaboratorFromGreenkeepingRotationsUseCaseTest {
    private val collaboratorId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private val collaborator2Id = UUID.nameUUIDFromBytes("u2".toByteArray())

    private lateinit var state: SessionState
    private lateinit var useCase: RemoveCollaboratorFromGreenkeepingRotationsUseCase
    private lateinit var changedRotation: GreenkeepingRotation
    private lateinit var alsoChangedRotation: GreenkeepingRotation
    private lateinit var untouchedRotation: GreenkeepingRotation

    @BeforeEach
    fun setup() {
        state = SessionState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))

        changedRotation = GreenkeepingRotation(
            name = "Alpha",
            updatedAt = Instant.EPOCH,
            updatedBy = collaboratorId,
        ).apply {
            collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaboratorId)
            collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaborator2Id)
        }
        alsoChangedRotation = GreenkeepingRotation(
            name = "Beta",
            updatedAt = Instant.EPOCH,
            updatedBy = collaborator2Id,
        ).apply {
            collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaboratorId)
        }
        untouchedRotation = GreenkeepingRotation(
            name = "Gamma",
            updatedAt = Instant.EPOCH,
            updatedBy = collaborator2Id,
        ).apply {
            collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaborator2Id)
        }

        state.greenkeepingRotations[changedRotation.id] = changedRotation
        state.greenkeepingRotations[alsoChangedRotation.id] = alsoChangedRotation
        state.greenkeepingRotations[untouchedRotation.id] = untouchedRotation
        useCase = RemoveCollaboratorFromGreenkeepingRotationsUseCase()
    }

    @Test
    fun `removes collaborator from all rotations and returns true`() {
        val changed = useCase.execute(state, collaboratorId)

        assertTrue(changed)
        assertEquals(listOf(collaborator2Id), changedRotation.collaborators.map { it.collaboratorId })
        assertTrue(alsoChangedRotation.collaborators.isEmpty())
    }

    @Test
    fun `updates metadata only for changed rotations`() {
        useCase.execute(state, collaboratorId)

        assertNull(changedRotation.updatedBy)
        assertTrue(changedRotation.updatedAt.isAfter(Instant.EPOCH))
        assertNull(alsoChangedRotation.updatedBy)
        assertTrue(alsoChangedRotation.updatedAt.isAfter(Instant.EPOCH))
        assertEquals(collaborator2Id, untouchedRotation.updatedBy)
        assertEquals(Instant.EPOCH, untouchedRotation.updatedAt)
    }

    @Test
    fun `returns false when collaborator is absent`() {
        val snapshot = state.greenkeepingRotations.mapValues { (_, rotation) ->
            rotation.collaborators.map { it.collaboratorId }
        }

        val changed = useCase.execute(state, UUID.randomUUID())

        assertFalse(changed)
        assertEquals(snapshot, state.greenkeepingRotations.mapValues { (_, rotation) -> rotation.collaborators.map { it.collaboratorId } })
        assertEquals(Instant.EPOCH, changedRotation.updatedAt)
        assertEquals(Instant.EPOCH, alsoChangedRotation.updatedAt)
        assertEquals(Instant.EPOCH, untouchedRotation.updatedAt)
    }
}

