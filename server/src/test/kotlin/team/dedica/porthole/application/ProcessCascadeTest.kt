package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.session.landscaping.RemoveConnectionUseCase
import team.dedica.porthole.application.session.landscaping.RemoveLandmarkUseCase
import team.dedica.porthole.domain.*

/**
 * Verifies that deleting a connection or landmark silently removes any
 * dangling connectionId references from process stages.
 */
class ProcessCascadeTest {

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private val broadcast: BroadcastPort = mock()
    private lateinit var removeConnectionUseCase: RemoveConnectionUseCase
    private lateinit var removeLandmarkUseCase: RemoveLandmarkUseCase
    private lateinit var processId: UUID
    private lateinit var stageId: UUID

    val ownerIdP1 = UUID.nameUUIDFromBytes("p1".toByteArray())
    private val lm1Id = UUID.nameUUIDFromBytes("lm1".toByteArray())
    private val lm2Id = UUID.nameUUIDFromBytes("lm2".toByteArray())
    private val c1Id = UUID.nameUUIDFromBytes("c1".toByteArray())
    private val c2Id = UUID.nameUUIDFromBytes("c2".toByteArray())

    @BeforeEach
    fun setup() {

        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = ownerIdP1, username = "Alice"))

        state.landmarks[lm1Id] = Landmark(id = lm1Id, name = "A", ownerId = ownerIdP1, coordinate = HexCoordinate(0, 0))
        state.landmarks[lm2Id] = Landmark(id = lm2Id, name = "B", ownerId = ownerIdP1, coordinate = HexCoordinate(2, 0))

        state.connections[c1Id] = Connection(
            id = c1Id, originId = lm1Id, targetId = lm2Id,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(2, 0)),
        )
        state.connections[c2Id] = Connection(
            id = c2Id, originId = lm1Id, targetId = lm2Id,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(2, 0)),
        )

        // Process with one stage containing both connections
        val process = Process(name = "Flow")
        val stage = ProcessStage(order = 0)
        stage.connections.add(StageConnection(connectionId = c1Id))
        stage.connections.add(StageConnection(connectionId = c2Id))
        process.stages.add(stage)
        state.processes[process.id] = process
        processId = process.id
        stageId = stage.id

        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        removeConnectionUseCase = RemoveConnectionUseCase(mapStatePort, broadcast, authorizationPort)
        removeLandmarkUseCase = RemoveLandmarkUseCase(mapStatePort, broadcast, authorizationPort)
    }

    @Test
    fun `removing a connection removes its id from all process stages`() {
        removeConnectionUseCase.execute(state.id, c1Id, ownerIdP1)
        val saved = mapStatePort.findById(state.id)!!
        val stage = saved.processes[processId]!!.stages.find { it.id == stageId }!!
        assertFalse(stage.connections.any { it.connectionId == c1Id })
        assertTrue(stage.connections.any { it.connectionId == c2Id })
        verify(broadcast).sendProcesses(state.id)
    }

    @Test
    fun `removing a landmark removes its connections from process stages too`() {
        // lm1 participates in c1 and c2 – both should be removed from the stage
        removeLandmarkUseCase.execute(state.id, ownerIdP1, lm1Id)
        val saved = mapStatePort.findById(state.id)!!
        val stage = saved.processes[processId]!!.stages.find { it.id == stageId }!!
        assertTrue(stage.connections.isEmpty())
        verify(broadcast).sendProcesses(state.id)
    }

    @Test
    fun `removing unrelated landmark leaves stage connections intact`() {
        // Add a third landmark unrelated to c1/c2
        val lm3Id = UUID.nameUUIDFromBytes("lm3".toByteArray())
        state.landmarks[lm3Id] = Landmark(id = lm3Id, name = "C", ownerId = ownerIdP1, coordinate = HexCoordinate(-2, 0))
        mapStatePort.save(state)

        removeLandmarkUseCase.execute(state.id, ownerIdP1, lm3Id)
        val saved = mapStatePort.findById(state.id)!!
        val stage = saved.processes[processId]!!.stages.find { it.id == stageId }!!
        assertEquals(2, stage.connections.size)
        verify(broadcast, never()).sendProcesses(state.id)
    }

    @Test
    fun `cascade works across multiple stages`() {
        // Add a second stage also referencing c1
        val process = mapStatePort.findById(state.id)!!.processes[processId]!!
        val stage2 = ProcessStage(order = 1)
        stage2.connections.add(StageConnection(connectionId = c1Id))
        process.stages.add(stage2)
        mapStatePort.save(mapStatePort.findById(state.id)!!)

        removeConnectionUseCase.execute(state.id, c1Id, ownerIdP1)
        val saved = mapStatePort.findById(state.id)!!
        val stages = saved.processes[processId]!!.stages
        stages.forEach { s ->
            assertFalse(s.connections.any { it.connectionId == c1Id }, "Stage ${s.id} still contains c1")
        }
    }
}
