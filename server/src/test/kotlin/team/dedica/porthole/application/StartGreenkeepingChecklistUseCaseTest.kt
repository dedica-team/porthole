package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import team.dedica.porthole.application.session.greenkeeping.StartGreenkeepingChecklistUseCase
import team.dedica.porthole.domain.*
import java.time.LocalDate
import java.util.UUID

class StartGreenkeepingChecklistUseCaseTest {
    private val collaboratorId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private val groupId = UUID.nameUUIDFromBytes("g1".toByteArray())

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: StartGreenkeepingChecklistUseCase
    private lateinit var rotation: GreenkeepingRotation

    @BeforeEach
    fun setup() {
        state = SessionState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))
        state.collaborators += Collaborator(id = collaboratorId, username = "Alice")
        state.groups[groupId] = LandmarkGroup(id = groupId, name = "Core", color = "#00ffcc")
        rotation = GreenkeepingRotation(name = "Weekly")
        rotation.groupIds += groupId
        rotation.collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaboratorId)
        rotation.taskTemplates += GreenkeepingTaskTemplateItem(title = "Check logs")
        rotation.taskTemplates += GreenkeepingTaskTemplateItem(title = "Inspect backups")
        state.greenkeepingRotations[rotation.id] = rotation
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = StartGreenkeepingChecklistUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `starts a checklist initializing tasks from templates with default current date title`() {
        val updated = useCase.execute(state.id, rotation.id, title = null, callerId = collaboratorId)

        val checklist = updated.currentChecklist
        assertNotNull(checklist)
        assertEquals(LocalDate.now().toString(), checklist!!.title)
        assertEquals(collaboratorId, checklist.createdBy)
        assertNull(checklist.finishedAt)
        assertNull(checklist.finishedBy)
        assertEquals(2, checklist.items.size)
        assertEquals("Check logs", checklist.items[0].title)
        assertFalse(checklist.items[0].done)
        assertNull(checklist.items[0].note)
        assertEquals("Inspect backups", checklist.items[1].title)
        assertFalse(checklist.items[1].done)
    }

    @Test
    fun `starts a checklist with custom title`() {
        val updated = useCase.execute(state.id, rotation.id, title = "Sprint 42 Maintenance", callerId = collaboratorId)

        val checklist = updated.currentChecklist
        assertNotNull(checklist)
        assertEquals("Sprint 42 Maintenance", checklist!!.title)
    }

    @Test
    fun `throws exception when checklist is already active`() {
        useCase.execute(state.id, rotation.id, title = "Active 1", callerId = collaboratorId)

        assertThrows<IllegalStateException> {
            useCase.execute(state.id, rotation.id, title = "Active 2", callerId = collaboratorId)
        }
    }
}
