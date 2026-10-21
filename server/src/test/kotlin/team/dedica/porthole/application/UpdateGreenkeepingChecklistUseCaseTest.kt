package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import team.dedica.porthole.application.session.greenkeeping.GreenkeepingChecklistItemPatch
import team.dedica.porthole.application.session.greenkeeping.StartGreenkeepingChecklistUseCase
import team.dedica.porthole.application.session.greenkeeping.UpdateGreenkeepingChecklistUseCase
import team.dedica.porthole.domain.*
import java.util.UUID

class UpdateGreenkeepingChecklistUseCaseTest {
    private val collaboratorId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private val groupId = UUID.nameUUIDFromBytes("g1".toByteArray())

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var startUseCase: StartGreenkeepingChecklistUseCase
    private lateinit var updateUseCase: UpdateGreenkeepingChecklistUseCase
    private lateinit var rotation: GreenkeepingRotation

    @BeforeEach
    fun setup() {
        state = SessionState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))
        state.collaborators += Collaborator(id = collaboratorId, username = "Alice")
        state.groups[groupId] = LandmarkGroup(id = groupId, name = "Core", color = "#00ffcc")
        rotation = GreenkeepingRotation(name = "Weekly")
        rotation.groupIds += groupId
        rotation.collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaboratorId)
        rotation.taskTemplates += GreenkeepingTaskTemplateItem(title = "Task 1")
        state.greenkeepingRotations[rotation.id] = rotation
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        startUseCase = StartGreenkeepingChecklistUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        updateUseCase = UpdateGreenkeepingChecklistUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `updates active checklist title and items`() {
        startUseCase.execute(state.id, rotation.id, title = "Original", callerId = collaboratorId)

        val updated = updateUseCase.execute(
            sessionId = state.id,
            rotationId = rotation.id,
            title = "Updated Title",
            items = listOf(
                GreenkeepingChecklistItemPatch(title = "Task 1", done = true, note = "Completed on time"),
                GreenkeepingChecklistItemPatch(title = "Ad-hoc task", done = false, note = null),
            ),
            callerId = collaboratorId,
        )

        val checklist = updated.currentChecklist
        assertNotNull(checklist)
        assertEquals("Updated Title", checklist!!.title)
        assertEquals(2, checklist.items.size)
        assertEquals("Task 1", checklist.items[0].title)
        assertTrue(checklist.items[0].done)
        assertEquals("Completed on time", checklist.items[0].note)
        assertEquals("Ad-hoc task", checklist.items[1].title)
        assertFalse(checklist.items[1].done)
    }

    @Test
    fun `throws exception when updating non-existent active checklist`() {
        assertThrows<IllegalStateException> {
            updateUseCase.execute(
                sessionId = state.id,
                rotationId = rotation.id,
                title = "Title",
                items = emptyList(),
                callerId = collaboratorId,
            )
        }
    }
}
