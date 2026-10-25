package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.processes.*
import team.dedica.porthole.domain.*

class ProcessUseCaseTest {

    private val collaboratorId = UUID.nameUUIDFromBytes("p1".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var state: SessionState

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        state = SessionState(map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 }))
        state.collaborators.add(Collaborator(id = collaboratorId, username = "Alice"))
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
    }

    // ── ListProcessesUseCase ──────────────────────────────────────────────────

    @Test
    fun `list processes returns empty list when none exist`() {
        val useCase = ListProcessesUseCase(authorizationPort)
        assertEquals(emptyList<Process>(), useCase.execute(state.id, collaboratorId))
    }

    @Test
    fun `list processes returns sorted by name`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        createUseCase.execute(state.id, "Zzz Flow", null, collaboratorId)
        createUseCase.execute(state.id, "Aaa Flow", null, collaboratorId)
        val useCase = ListProcessesUseCase(authorizationPort)
        val result = useCase.execute(state.id, collaboratorId)
        assertEquals("Aaa Flow", result[0].name)
        assertEquals("Zzz Flow", result[1].name)
    }

    @Test
    fun `list processes unknown map throws NoSuchElementException`() {
        val useCase = ListProcessesUseCase(authorizationPort)
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaboratorId)
        }
    }

    // ── EditProcessUseCase ────────────────────────────────────────────────────

    @Test
    fun `edit process updates name`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        val processes = createUseCase.execute(state.id, "Old Name", null, collaboratorId)
        val processId = processes.first().id

        val editUseCase = EditProcessUseCase(mapStatePort, authorizationPort)
        val result = editUseCase.execute(state.id, processId, "New Name", null, collaboratorId)
        assertEquals("New Name", result.first { it.id == processId }.name)
    }

    @Test
    fun `edit process updates description`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        val processes = createUseCase.execute(state.id, "Flow", null, collaboratorId)
        val processId = processes.first().id

        val editUseCase = EditProcessUseCase(mapStatePort, authorizationPort)
        val result = editUseCase.execute(state.id, processId, null, "A description", collaboratorId)
        assertEquals("A description", result.first { it.id == processId }.description)
    }

    @Test
    fun `edit process unknown process throws NoSuchElementException`() {
        val useCase = EditProcessUseCase(mapStatePort, authorizationPort)
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), "Name", null, collaboratorId)
        }
    }

    @Test
    fun `edit process non-collaborator throws AccessDeniedException`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        val processes = createUseCase.execute(state.id, "Flow", null, collaboratorId)
        val processId = processes.first().id
        val useCase = EditProcessUseCase(mapStatePort, authorizationPort)
        assertThrows(team.dedica.porthole.domain.AccessDeniedException::class.java) {
            useCase.execute(state.id, processId, "Hack", null, UUID.randomUUID())
        }
    }

    // ── RemoveProcessUseCase ──────────────────────────────────────────────────

    @Test
    fun `remove process deletes it`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        val processes = createUseCase.execute(state.id, "Flow", null, collaboratorId)
        val processId = processes.first().id

        val removeUseCase = RemoveProcessUseCase(mapStatePort, authorizationPort)
        val result = removeUseCase.execute(state.id, processId, collaboratorId)
        assertTrue(result.none { it.id == processId })
    }

    @Test
    fun `remove process unknown process throws IllegalArgumentException`() {
        val useCase = RemoveProcessUseCase(mapStatePort, authorizationPort)
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), collaboratorId)
        }
    }

    // ── EditProcessStageUseCase ───────────────────────────────────────────────

    @Test
    fun `edit stage updates name`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        val processes = createUseCase.execute(state.id, "Flow", null, collaboratorId)
        val processId = processes.first().id
        val addStage = AddProcessStageUseCase(mapStatePort, authorizationPort)
        val updated = addStage.execute(state.id, processId, "Stage One", 0, collaboratorId)
        val stageId = updated.first { it.id == processId }.stages.first().id

        val editStage = EditProcessStageUseCase(mapStatePort, authorizationPort)
        val result = editStage.execute(state.id, processId, stageId, "Renamed", false, null, collaboratorId)
        assertEquals("Renamed", result.first { it.id == processId }.stages.first { it.id == stageId }.name)
    }

    @Test
    fun `edit stage clearName sets name to null`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        val processes = createUseCase.execute(state.id, "Flow", null, collaboratorId)
        val processId = processes.first().id
        val addStage = AddProcessStageUseCase(mapStatePort, authorizationPort)
        val updated = addStage.execute(state.id, processId, "Stage One", 0, collaboratorId)
        val stageId = updated.first { it.id == processId }.stages.first().id

        val editStage = EditProcessStageUseCase(mapStatePort, authorizationPort)
        val result = editStage.execute(state.id, processId, stageId, null, true, null, collaboratorId)
        assertNull(result.first { it.id == processId }.stages.first { it.id == stageId }.name)
    }

    // ── RemoveProcessStageUseCase ─────────────────────────────────────────────

    @Test
    fun `remove stage deletes it from process`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        val processes = createUseCase.execute(state.id, "Flow", null, collaboratorId)
        val processId = processes.first().id
        val addStage = AddProcessStageUseCase(mapStatePort, authorizationPort)
        val updated = addStage.execute(state.id, processId, "Stage", 0, collaboratorId)
        val stageId = updated.first { it.id == processId }.stages.first().id

        val removeStage = RemoveProcessStageUseCase(mapStatePort, authorizationPort)
        val result = removeStage.execute(state.id, processId, stageId, collaboratorId)
        assertTrue(result.first { it.id == processId }.stages.none { it.id == stageId })
    }

    @Test
    fun `remove stage unknown stage throws IllegalArgumentException`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        val processes = createUseCase.execute(state.id, "Flow", null, collaboratorId)
        val processId = processes.first().id

        val useCase = RemoveProcessStageUseCase(mapStatePort, authorizationPort)
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, processId, UUID.randomUUID(), collaboratorId)
        }
    }

    // ── ReorderProcessStagesUseCase ───────────────────────────────────────────

    @Test
    fun `reorder stages changes their order`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        val processes = createUseCase.execute(state.id, "Flow", null, collaboratorId)
        val processId = processes.first().id
        val addStage = AddProcessStageUseCase(mapStatePort, authorizationPort)
        addStage.execute(state.id, processId, "First", 0, collaboratorId)
        val updated = addStage.execute(state.id, processId, "Second", 1, collaboratorId)
        val stages = updated.first { it.id == processId }.stages.sortedBy { it.order }
        val firstId = stages[0].id
        val secondId = stages[1].id

        val reorderUseCase = ReorderProcessStagesUseCase(mapStatePort, authorizationPort)
        val result = reorderUseCase.execute(state.id, processId, listOf(secondId, firstId), collaboratorId)
        val reordered = result.first { it.id == processId }.stages.sortedBy { it.order }
        assertEquals(secondId, reordered[0].id)
        assertEquals(firstId, reordered[1].id)
    }

    @Test
    fun `reorder with wrong count throws IllegalArgumentException`() {
        val createUseCase = CreateProcessUseCase(mapStatePort, authorizationPort)
        val processes = createUseCase.execute(state.id, "Flow", null, collaboratorId)
        val processId = processes.first().id
        val addStage = AddProcessStageUseCase(mapStatePort, authorizationPort)
        addStage.execute(state.id, processId, "Stage", 0, collaboratorId)

        val useCase = ReorderProcessStagesUseCase(mapStatePort, authorizationPort)
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, processId, listOf(UUID.randomUUID(), UUID.randomUUID()), collaboratorId)
        }
    }

    // ── EditStageConnectionUseCase ────────────────────────────────────────────

    @Test
    fun `edit stage connection updates title`() {
        // Setup: process with stage and a connection
        val lm1Id = UUID.nameUUIDFromBytes("lm1".toByteArray())
        val lm2Id = UUID.nameUUIDFromBytes("lm2".toByteArray())
        state.landmarks[lm1Id] = Landmark(id = lm1Id, name = "A", ownerId = collaboratorId, coordinate = HexCoordinate(0, 0))
        state.landmarks[lm2Id] = Landmark(id = lm2Id, name = "B", ownerId = collaboratorId, coordinate = HexCoordinate(2, 0))
        val conn = Connection(originId = lm1Id, targetId = lm2Id,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(2, 0)))
        state.connections[conn.id] = conn
        val process = Process(name = "Flow")
        val stage = ProcessStage(order = 0)
        val stageConn = StageConnection(connectionId = conn.id, title = "Original")
        stage.connections.add(stageConn)
        process.stages.add(stage)
        state.processes[process.id] = process
        mapStatePort.save(state)

        val editUseCase = EditStageConnectionUseCase(mapStatePort, authorizationPort)
        val result = editUseCase.execute(state.id, process.id, stage.id, stageConn.id, "Updated", false, null, collaboratorId)
        val updatedConn = result.first { it.id == process.id }.stages.first { it.id == stage.id }.connections.first { it.id == stageConn.id }
        assertEquals("Updated", updatedConn.title)
    }

    // ── RemoveStageConnectionUseCase ──────────────────────────────────────────

    @Test
    fun `remove stage connection deletes it`() {
        val lm1Id = UUID.nameUUIDFromBytes("lm1".toByteArray())
        val lm2Id = UUID.nameUUIDFromBytes("lm2".toByteArray())
        state.landmarks[lm1Id] = Landmark(id = lm1Id, name = "A", ownerId = collaboratorId, coordinate = HexCoordinate(0, 0))
        state.landmarks[lm2Id] = Landmark(id = lm2Id, name = "B", ownerId = collaboratorId, coordinate = HexCoordinate(2, 0))
        val conn = Connection(originId = lm1Id, targetId = lm2Id,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(2, 0)))
        state.connections[conn.id] = conn
        val process = Process(name = "Flow")
        val stage = ProcessStage(order = 0)
        val stageConn = StageConnection(connectionId = conn.id)
        stage.connections.add(stageConn)
        process.stages.add(stage)
        state.processes[process.id] = process
        mapStatePort.save(state)

        val removeUseCase = RemoveStageConnectionUseCase(mapStatePort, authorizationPort)
        val result = removeUseCase.execute(state.id, process.id, stage.id, stageConn.id, collaboratorId)
        val updatedStage = result.first { it.id == process.id }.stages.first { it.id == stage.id }
        assertTrue(updatedStage.connections.none { it.id == stageConn.id })
    }

    @Test
    fun `remove stage connection unknown process throws NoSuchElementException`() {
        val useCase = RemoveStageConnectionUseCase(mapStatePort, authorizationPort)
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), collaboratorId)
        }
    }
}

