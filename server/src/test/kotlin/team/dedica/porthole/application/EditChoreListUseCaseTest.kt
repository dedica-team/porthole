package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.EditChoreListUseCase
import team.dedica.porthole.domain.*

class EditChoreListUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var listId: String
    private lateinit var lm1: String
    private lateinit var lm2: String
    private lateinit var editUseCase: EditChoreListUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "u1", username = "Alice"))
        val l1 = Landmark(id = "lm-1", name = "Reception", ownerId = "u1", type = LandmarkType.KEEP)
        val l2 = Landmark(id = "lm-2", name = "Surgery", ownerId = "u1", type = LandmarkType.KEEP)
        lm1 = l1.id; lm2 = l2.id
        state.landmarks[l1.id] = l1; state.landmarks[l2.id] = l2
        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        userPort = InMemoryTestUserRepository().also { it.save(UserRecord("u1", "Alice", "gh-1")) }
        val broadcast = NoOpBroadcastPort()
        // Create initial list with lm1
        val createUseCase = CreateChoreListUseCase(mapStatePort, userPort, broadcast)
        listId = createUseCase.execute(state.id, "Old Title", listOf(lm1), null, "Alice")[0].id
        editUseCase = EditChoreListUseCase(mapStatePort, userPort, broadcast)
    }

    @Test
    fun `updates title`() {
        val result = editUseCase.execute(state.id, listId, "New Title", null, null, false, "Alice")
        assertEquals("New Title", result[0].title)
    }

    @Test
    fun `sets and clears link`() {
        editUseCase.execute(state.id, listId, null, null, "https://wiki.example", false, "Alice")
        assertEquals("https://wiki.example", mapStatePort.findById(state.id)!!.choreLists[listId]!!.link)
        editUseCase.execute(state.id, listId, null, null, null, true, "Alice")
        assertNull(mapStatePort.findById(state.id)!!.choreLists[listId]!!.link)
    }

    @Test
    fun `adds new landmarks with NONE state`() {
        editUseCase.execute(state.id, listId, null, listOf(lm1, lm2), null, false, "Alice")
        val list = mapStatePort.findById(state.id)!!.choreLists[listId]!!
        assertTrue(list.entries.containsKey(lm2))
        assertEquals(ChoreEntryState.NONE, list.entries[lm2]!!.state)
    }

    @Test
    fun `removes de-selected landmarks`() {
        editUseCase.execute(state.id, listId, null, emptyList(), null, false, "Alice")
        val list = mapStatePort.findById(state.id)!!.choreLists[listId]!!
        assertTrue(list.entries.isEmpty())
    }

    @Test
    fun `preserves entry state for unchanged landmarks`() {
        // Manually set lm1 state to DONE
        mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[lm1]!!.state = ChoreEntryState.DONE
        mapStatePort.save(mapStatePort.findById(state.id)!!)
        // Edit keeping lm1 + adding lm2
        editUseCase.execute(state.id, listId, null, listOf(lm1, lm2), null, false, "Alice")
        val list = mapStatePort.findById(state.id)!!.choreLists[listId]!!
        assertEquals(ChoreEntryState.DONE, list.entries[lm1]!!.state)
    }

    @Test
    fun `ignores blank title (keeps old)`() {
        editUseCase.execute(state.id, listId, "   ", null, null, false, "Alice")
        val list = mapStatePort.findById(state.id)!!.choreLists[listId]!!
        assertEquals("Old Title", list.title)
    }

    @Test
    fun `non-collaborator throws IllegalArgumentException`() {
        userPort.save(UserRecord("u2", "Bob", "gh-2"))
        assertThrows(IllegalArgumentException::class.java) {
            editUseCase.execute(state.id, listId, "Hack", null, null, false, "Bob")
        }
    }

    @Test
    fun `unknown list throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            editUseCase.execute(state.id, "no-list", "Title", null, null, false, "Alice")
        }
    }

    @Test
    fun `unknown landmark throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            editUseCase.execute(state.id, listId, null, listOf("ghost"), null, false, "Alice")
        }
    }
}

