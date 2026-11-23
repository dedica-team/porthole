package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.processes.AddStageConnectionUseCase
import team.dedica.porthole.domain.*

class AddStageConnectionUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: AddStageConnectionUseCase
    private lateinit var processId: UUID
    private lateinit var stageId: UUID
    private lateinit var connectionId: UUID

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))

        val lm1Id = UUID.nameUUIDFromBytes("lm1".toByteArray())
        val lm2Id = UUID.nameUUIDFromBytes("lm2".toByteArray())
        state.landmarks[lm1Id] = Landmark(id = lm1Id, name = "A", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(0, 0))
        state.landmarks[lm2Id] = Landmark(id = lm2Id, name = "B", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()), coordinate = HexCoordinate(2, 0))
        val conn = Connection(originId = lm1Id, targetId = lm2Id,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(2, 0)))
        state.connections[conn.id] = conn
        connectionId = conn.id

        val process = Process(name = "Flow")
        val stage = ProcessStage(order = 0)
        process.stages.add(stage)
        state.processes[process.id] = process
        processId = process.id
        stageId = stage.id

        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = AddStageConnectionUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `adds connection id to stage`() {
        val result = useCase.execute(state.id, processId, stageId, connectionId, null, "FORWARD", collaborator.id)
        val stage = result.find { it.id == processId }!!.stages.find { it.id == stageId }!!
        assertTrue(stage.connections.any { it.connectionId == connectionId })
    }

    @Test
    fun `adding the same connection twice is idempotent`() {
        useCase.execute(state.id, processId, stageId, connectionId, null, "FORWARD", collaborator.id)
        val result = useCase.execute(state.id, processId, stageId, connectionId, null, "FORWARD", collaborator.id)
        val stage = result.find { it.id == processId }!!.stages.find { it.id == stageId }!!
        assertEquals(1, stage.connections.size)
    }

    @Test
    fun `non-existent connection throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, processId, stageId, UUID.randomUUID(), null, "FORWARD", collaborator.id)
        }
    }

    @Test
    fun `non-existent stage throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, processId, UUID.randomUUID(), connectionId, null, "FORWARD", collaborator.id)
        }
    }

    @Test
    fun `non-existent process throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), stageId, connectionId, null, "FORWARD", collaborator.id)
        }
    }

    @Test
    fun `non-collaborator throws AccessDeniedException`() {
        assertThrows(team.dedica.porthole.domain.AccessDeniedException::class.java) {
            useCase.execute(state.id, processId, stageId, connectionId, null, "FORWARD", collaborator2.id)
        }
    }

    @Test
    fun `persists the connection reference`() {
        useCase.execute(state.id, processId, stageId, connectionId, null, "FORWARD", collaborator.id)
        val saved = mapStatePort.findById(state.id)!!
        val stage = saved.processes[processId]!!.stages.find { it.id == stageId }!!
        assertTrue(stage.connections.any { it.connectionId == connectionId })
    }
}
