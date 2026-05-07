package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.greenkeeping.RemoveGroupFromGreenkeepingRotationsUseCase
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState
import java.time.Instant
import java.util.UUID

class RemoveGroupFromGreenkeepingRotationsUseCaseTest {
    private val groupId = UUID.nameUUIDFromBytes("g1".toByteArray())
    private val group2Id = UUID.nameUUIDFromBytes("g2".toByteArray())
    private val updatedById = UUID.nameUUIDFromBytes("u1".toByteArray())

    private lateinit var state: SessionState
    private lateinit var useCase: RemoveGroupFromGreenkeepingRotationsUseCase
    private lateinit var changedRotation: GreenkeepingRotation
    private lateinit var alsoChangedRotation: GreenkeepingRotation
    private lateinit var untouchedRotation: GreenkeepingRotation

    @BeforeEach
    fun setup() {
        state = SessionState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))

        changedRotation = GreenkeepingRotation(
            name = "Alpha",
            updatedAt = Instant.EPOCH,
            updatedBy = updatedById,
        ).apply {
            groupIds += groupId
            groupIds += group2Id
        }
        alsoChangedRotation = GreenkeepingRotation(
            name = "Beta",
            updatedAt = Instant.EPOCH,
            updatedBy = updatedById,
        ).apply {
            groupIds += groupId
        }
        untouchedRotation = GreenkeepingRotation(
            name = "Gamma",
            updatedAt = Instant.EPOCH,
            updatedBy = updatedById,
        ).apply {
            groupIds += group2Id
        }

        state.greenkeepingRotations[changedRotation.id] = changedRotation
        state.greenkeepingRotations[alsoChangedRotation.id] = alsoChangedRotation
        state.greenkeepingRotations[untouchedRotation.id] = untouchedRotation
        useCase = RemoveGroupFromGreenkeepingRotationsUseCase()
    }

    @Test
    fun `removes group from all rotations and returns true`() {
        val changed = useCase.execute(state, groupId)

        assertTrue(changed)
        assertEquals(listOf(group2Id), changedRotation.groupIds)
        assertTrue(alsoChangedRotation.groupIds.isEmpty())
    }

    @Test
    fun `updates metadata only for changed rotations`() {
        useCase.execute(state, groupId)

        assertNull(changedRotation.updatedBy)
        assertTrue(changedRotation.updatedAt.isAfter(Instant.EPOCH))
        assertNull(alsoChangedRotation.updatedBy)
        assertTrue(alsoChangedRotation.updatedAt.isAfter(Instant.EPOCH))
        assertEquals(updatedById, untouchedRotation.updatedBy)
        assertEquals(Instant.EPOCH, untouchedRotation.updatedAt)
    }

    @Test
    fun `returns false when group is absent`() {
        val snapshot = state.greenkeepingRotations.mapValues { (_, rotation) -> rotation.groupIds.toList() }

        val changed = useCase.execute(state, UUID.randomUUID())

        assertFalse(changed)
        assertEquals(snapshot, state.greenkeepingRotations.mapValues { (_, rotation) -> rotation.groupIds.toList() })
        assertEquals(Instant.EPOCH, changedRotation.updatedAt)
        assertEquals(Instant.EPOCH, alsoChangedRotation.updatedAt)
        assertEquals(Instant.EPOCH, untouchedRotation.updatedAt)
    }
}

