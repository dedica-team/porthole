package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.domain.*

class CreateChoreListUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var broadcast: NoOpBroadcastPort
    private lateinit var useCase: CreateChoreListUseCase
    private lateinit var landmarkId: String

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "u1", username = "Alice"))
        val landmark = Landmark(id = "lm-1", name = "Reception", ownerId = "u1", type = LandmarkType.KEEP)
        landmarkId = landmark.id
        state.landmarks[landmark.id] = landmark
        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        userPort = InMemoryTestUserRepository().also { it.save(UserRecord("u1", "Alice", "gh-1")) }
        broadcast = NoOpBroadcastPort()
        useCase = CreateChoreListUseCase(mapStatePort, userPort, broadcast)
    }

    @Test
    fun `creates a chore list and returns sorted list`() {
        val result = useCase.execute(state.id, "Audit", listOf(landmarkId), null, "Alice")
        assertEquals(1, result.size)
        assertEquals("Audit", result[0].title)
    }

    @Test
    fun `creates entry for each provided landmark`() {
        useCase.execute(state.id, "Audit", listOf(landmarkId), null, "Alice")
        val saved = mapStatePort.findById(state.id)!!
        val list = saved.choreLists.values.first()
        assertTrue(list.entries.containsKey(landmarkId))
        assertEquals(ChoreEntryState.NONE, list.entries[landmarkId]!!.state)
    }

    @Test
    fun `new list has completed=false`() {
        useCase.execute(state.id, "Audit", listOf(landmarkId), null, "Alice")
        val list = mapStatePort.findById(state.id)!!.choreLists.values.first()
        assertFalse(list.completed)
    }

    @Test
    fun `blank title throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "   ", listOf(landmarkId), null, "Alice")
        }
    }

    @Test
    fun `non-collaborator throws IllegalArgumentException`() {
        userPort.save(UserRecord("u2", "Bob", "gh-2"))
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Audit", listOf(landmarkId), null, "Bob")
        }
    }

    @Test
    fun `unknown landmark throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Audit", listOf("no-such-landmark"), null, "Alice")
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-map", "Audit", listOf(landmarkId), null, "Alice")
        }
    }

    @Test
    fun `returned list is sorted by title`() {
        useCase.execute(state.id, "Zebra", emptyList(), null, "Alice")
        val result = useCase.execute(state.id, "Alpha", emptyList(), null, "Alice")
        assertEquals("Alpha", result[0].title)
        assertEquals("Zebra", result[1].title)
    }

    @Test
    fun `persists the new chore list`() {
        useCase.execute(state.id, "My List", emptyList(), null, "Alice")
        val saved = mapStatePort.findById(state.id)!!
        assertEquals(1, saved.choreLists.size)
    }
}

