package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.processes.AddProcessStageUseCase
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.MapState
import team.dedica.porthole.domain.Process

class AddProcessStageUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var addStageUseCase: AddProcessStageUseCase
    private lateinit var processId: UUID

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        userPort = InMemoryTestUserRepository().also { it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1")) }

        // Create a process first
        val process = Process(name = "My Flow")
        state.processes[process.id] = process
        mapStatePort.save(state)
        processId = process.id

        addStageUseCase = AddProcessStageUseCase(mapStatePort, userPort)
    }

    @Test
    fun `adds a stage to a process`() {
        val result = addStageUseCase.execute(state.id, processId, "Analysis", 0, "Alice")
        val process = result.find { it.id == processId }!!
        assertEquals(1, process.stages.size)
        assertEquals("Analysis", process.stages[0].name)
        assertEquals(0, process.stages[0].order)
    }

    @Test
    fun `stage without name is created with null name`() {
        val result = addStageUseCase.execute(state.id, processId, null, 0, "Alice")
        val stage = result.find { it.id == processId }!!.stages[0]
        assertNull(stage.name)
    }

    @Test
    fun `multiple stages are sorted by order`() {
        addStageUseCase.execute(state.id, processId, "Third", 2, "Alice")
        addStageUseCase.execute(state.id, processId, "First", 0, "Alice")
        val result = addStageUseCase.execute(state.id, processId, "Second", 1, "Alice")
        val stages = result.find { it.id == processId }!!.stages
        assertEquals(listOf("First", "Second", "Third"), stages.map { it.name })
    }

    @Test
    fun `persists the new stage`() {
        addStageUseCase.execute(state.id, processId, "Saved Stage", 0, "Alice")
        val saved = mapStatePort.findById(state.id)!!.processes[processId]!!
        assertEquals(1, saved.stages.size)
    }

    @Test
    fun `unknown process throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            addStageUseCase.execute(state.id, UUID.randomUUID(), "X", 0, "Alice")
        }
    }

    @Test
    fun `non-collaborator throws IllegalArgumentException`() {
        userPort.save(UserRecord(UUID.nameUUIDFromBytes("p2".toByteArray()), "Bob", "gh-2"))
        assertThrows(IllegalArgumentException::class.java) {
            addStageUseCase.execute(state.id, processId, "Stage", 0, "Bob")
        }
    }
}
