package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import team.dedica.porthole.application.session.greenkeeping.FinishGreenkeepingChecklistUseCase
import team.dedica.porthole.application.session.greenkeeping.StartGreenkeepingChecklistUseCase
import team.dedica.porthole.application.session.greenkeeping.UpdateGreenkeepingChecklistUseCase
import team.dedica.porthole.domain.*
import java.util.UUID

class FinishGreenkeepingChecklistUseCaseTest {
    private val collaboratorId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private val groupId = UUID.nameUUIDFromBytes("g1".toByteArray())

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var startUseCase: StartGreenkeepingChecklistUseCase
    private lateinit var updateUseCase: UpdateGreenkeepingChecklistUseCase
    private lateinit var finishUseCase: FinishGreenkeepingChecklistUseCase
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
        finishUseCase = FinishGreenkeepingChecklistUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `finishes active checklist and archives it immutably to completedChecklists`() {
        startUseCase.execute(state.id, rotation.id, title = "Shift 1", callerId = collaboratorId)

        val updated = finishUseCase.execute(state.id, rotation.id, callerId = collaboratorId)

        assertNull(updated.currentChecklist)
        assertEquals(1, updated.completedChecklists.size)
        val finished = updated.completedChecklists[0]
        assertEquals("Shift 1", finished.title)
        assertNotNull(finished.finishedAt)
        assertEquals(collaboratorId, finished.finishedBy)

        // Subsequent update attempt on active checklist fails because active checklist is null
        assertThrows<IllegalStateException> {
            updateUseCase.execute(state.id, rotation.id, title = "New Title", items = emptyList(), callerId = collaboratorId)
        }
    }

    @Test
    fun `allows starting a new checklist after finishing previous one`() {
        startUseCase.execute(state.id, rotation.id, title = "Shift 1", callerId = collaboratorId)
        finishUseCase.execute(state.id, rotation.id, callerId = collaboratorId)

        val secondStart = startUseCase.execute(state.id, rotation.id, title = "Shift 2", callerId = collaboratorId)
        assertNotNull(secondStart.currentChecklist)
        assertEquals("Shift 2", secondStart.currentChecklist!!.title)
        assertEquals(1, secondStart.completedChecklists.size)
    }
}
