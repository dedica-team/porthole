package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.landscaping.RemoveConnectionUseCase
import team.dedica.porthole.application.session.landscaping.RemoveLandmarkUseCase
import team.dedica.porthole.domain.*

/**
 * Verifies that deleting a connection or landmark silently removes any
 * dangling connectionId references from process stages.
 */
class ProcessCascadeTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var removeConnectionUseCase: RemoveConnectionUseCase
    private lateinit var removeLandmarkUseCase: RemoveLandmarkUseCase
    private lateinit var processId: String
    private lateinit var stageId: String

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "p1", username = "Alice"))

        state.landmarks["lm1"] = Landmark(id = "lm1", name = "A", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        state.landmarks["lm2"] = Landmark(id = "lm2", name = "B", ownerId = "p1", coordinate = HexCoordinate(2, 0))
        state.map.setOwner(HexCoordinate(0, 0), "p1")
        state.map.setOwner(HexCoordinate(2, 0), "p1")

        state.connections["c1"] = Connection(
            id = "c1", originId = "lm1", targetId = "lm2",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(2, 0)),
        )
        state.connections["c2"] = Connection(
            id = "c2", originId = "lm1", targetId = "lm2",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(2, 0)),
        )

        // Process with one stage containing both connections
        val process = Process(name = "Flow")
        val stage = ProcessStage(order = 0)
        stage.connections.add(StageConnection(connectionId = "c1"))
        stage.connections.add(StageConnection(connectionId = "c2"))
        process.stages.add(stage)
        state.processes[process.id] = process
        processId = process.id
        stageId = stage.id

        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }
        removeConnectionUseCase = RemoveConnectionUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        removeLandmarkUseCase = RemoveLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `removing a connection removes its id from all process stages`() {
        removeConnectionUseCase.execute(state.id, "c1", "Alice")
        val saved = mapStatePort.findById(state.id)!!
        val stage = saved.processes[processId]!!.stages.find { it.id == stageId }!!
        assertFalse(stage.connections.any { it.connectionId == "c1" })
        assertTrue(stage.connections.any { it.connectionId == "c2" })
    }

    @Test
    fun `removing a landmark removes its connections from process stages too`() {
        // lm1 participates in c1 and c2 – both should be removed from the stage
        removeLandmarkUseCase.execute(state.id, "Alice", "lm1")
        val saved = mapStatePort.findById(state.id)!!
        val stage = saved.processes[processId]!!.stages.find { it.id == stageId }!!
        assertTrue(stage.connections.isEmpty())
    }

    @Test
    fun `removing unrelated landmark leaves stage connections intact`() {
        // Add a third landmark unrelated to c1/c2
        state.landmarks["lm3"] = Landmark(id = "lm3", name = "C", ownerId = "p1", coordinate = HexCoordinate(-2, 0))
        state.map.setOwner(HexCoordinate(-2, 0), "p1")
        mapStatePort.save(state)

        removeLandmarkUseCase.execute(state.id, "Alice", "lm3")
        val saved = mapStatePort.findById(state.id)!!
        val stage = saved.processes[processId]!!.stages.find { it.id == stageId }!!
        assertEquals(2, stage.connections.size)
    }

    @Test
    fun `cascade works across multiple stages`() {
        // Add a second stage also referencing c1
        val process = mapStatePort.findById(state.id)!!.processes[processId]!!
        val stage2 = ProcessStage(order = 1)
        stage2.connections.add(StageConnection(connectionId = "c1"))
        process.stages.add(stage2)
        mapStatePort.save(mapStatePort.findById(state.id)!!)

        removeConnectionUseCase.execute(state.id, "c1", "Alice")
        val saved = mapStatePort.findById(state.id)!!
        val stages = saved.processes[processId]!!.stages
        stages.forEach { s ->
            assertFalse(s.connections.any { it.connectionId == "c1" }, "Stage ${s.id} still contains c1")
        }
    }
}

