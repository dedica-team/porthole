package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.processes.AddStageConnectionUseCase
import team.dedica.porthole.domain.*

class AddStageConnectionUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: AddStageConnectionUseCase
    private lateinit var processId: String
    private lateinit var stageId: String

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "p1", username = "Alice"))

        // Two landmarks and a connection between them
        state.landmarks["lm1"] = Landmark(id = "lm1", name = "A", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        state.landmarks["lm2"] = Landmark(id = "lm2", name = "B", ownerId = "p1", coordinate = HexCoordinate(2, 0))
        state.connections["c1"] = Connection(
            id = "c1", originId = "lm1", targetId = "lm2",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(2, 0)),
        )

        val process = Process(name = "Flow")
        val stage = ProcessStage(order = 0)
        process.stages.add(stage)
        state.processes[process.id] = process
        processId = process.id
        stageId = stage.id

        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        userPort = InMemoryTestUserRepository().also { it.save(UserRecord("p1", "Alice", "gh-1")) }
        useCase = AddStageConnectionUseCase(mapStatePort, userPort)
    }

    @Test
    fun `adds connection id to stage`() {
        val result = useCase.execute(state.id, processId, stageId, "c1", null, "FORWARD", "Alice")
        val stage = result.find { it.id == processId }!!.stages.find { it.id == stageId }!!
        assertTrue(stage.connections.any { it.connectionId == "c1" })
    }

    @Test
    fun `adding the same connection twice is idempotent`() {
        useCase.execute(state.id, processId, stageId, "c1", null, "FORWARD", "Alice")
        val result = useCase.execute(state.id, processId, stageId, "c1", null, "FORWARD", "Alice")
        val stage = result.find { it.id == processId }!!.stages.find { it.id == stageId }!!
        assertEquals(1, stage.connections.size)
    }

    @Test
    fun `non-existent connection throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, processId, stageId, "no-such-conn", null, "FORWARD", "Alice")
        }
    }

    @Test
    fun `non-existent stage throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, processId, "bad-stage", "c1", null, "FORWARD", "Alice")
        }
    }

    @Test
    fun `non-existent process throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "bad-process", stageId, "c1", null, "FORWARD", "Alice")
        }
    }

    @Test
    fun `non-collaborator throws IllegalArgumentException`() {
        userPort.save(UserRecord("p2", "Bob", "gh-2"))
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, processId, stageId, "c1", null, "FORWARD", "Bob")
        }
    }

    @Test
    fun `persists the connection reference`() {
        useCase.execute(state.id, processId, stageId, "c1", null, "FORWARD", "Alice")
        val saved = mapStatePort.findById(state.id)!!
        val stage = saved.processes[processId]!!.stages.find { it.id == stageId }!!
        assertTrue(stage.connections.any { it.connectionId == "c1" })
    }
}

