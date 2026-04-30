package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.UpdateChoreEntryUseCase
import team.dedica.porthole.domain.*

class UpdateChoreEntryUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var listId: String
    private lateinit var landmarkId: String
    private lateinit var useCase: UpdateChoreEntryUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "u1", username = "Alice"))
        state.collaborators.add(Collaborator(id = "u2", username = "Bob"))
        val landmark = Landmark(id = "lm-1", name = "Pharmacy", ownerId = "u1", type = LandmarkType.KEEP)
        landmarkId = landmark.id
        state.landmarks[landmark.id] = landmark
        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("u1", "Alice", "gh-1"))
            it.save(UserRecord("u2", "Bob", "gh-2"))
        }
        val broadcast = NoOpBroadcastPort()
        listId = CreateChoreListUseCase(mapStatePort, userPort, broadcast)
            .execute(state.id, "Sprint", listOf(landmarkId), null, "Alice")[0].id
        useCase = UpdateChoreEntryUseCase(mapStatePort, userPort, broadcast)
    }

    private fun patch(
        state: ChoreEntryState? = null,
        assigneeId: String? = null,
        clearAssignee: Boolean = false,
        link: String? = null,
        clearLink: Boolean = false,
        note: String? = null,
        clearNote: Boolean = false,
    ) = useCase.execute(
        mapId = this.state.id, listId = listId, landmarkId = landmarkId,
        state = state, assigneeId = assigneeId, clearAssignee = clearAssignee,
        link = link, clearLink = clearLink, note = note, clearNote = clearNote,
        username = "Alice",
    )

    @Test
    fun `sets state`() {
        patch(state = ChoreEntryState.DONE)
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[landmarkId]!!
        assertEquals(ChoreEntryState.DONE, entry.state)
    }

    @Test
    fun `sets assignee when collaborator`() {
        patch(assigneeId = "u2")
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[landmarkId]!!
        assertEquals("u2", entry.assigneeId)
    }

    @Test
    fun `clears assignee`() {
        patch(assigneeId = "u2")
        patch(clearAssignee = true)
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[landmarkId]!!
        assertNull(entry.assigneeId)
    }

    @Test
    fun `non-collaborator assignee throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            patch(assigneeId = "outsider-id")
        }
    }

    @Test
    fun `sets link`() {
        patch(link = "https://wiki.example/audit")
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[landmarkId]!!
        assertEquals("https://wiki.example/audit", entry.link)
    }

    @Test
    fun `clears link`() {
        patch(link = "https://example.com")
        patch(clearLink = true)
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[landmarkId]!!
        assertNull(entry.link)
    }

    @Test
    fun `sets note`() {
        patch(note = "Check the fridges")
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[landmarkId]!!
        assertEquals("Check the fridges", entry.note)
    }

    @Test
    fun `clears note`() {
        patch(note = "temp note")
        patch(clearNote = true)
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[landmarkId]!!
        assertNull(entry.note)
    }

    @Test
    fun `returns the updated chore list`() {
        val result = patch(state = ChoreEntryState.BLOCKED)
        assertEquals(listId, result.id)
        assertEquals(ChoreEntryState.BLOCKED, result.entries[landmarkId]!!.state)
    }

    @Test
    fun `unknown entry throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, listId, "ghost-lm", null, null, false, null, false, null, false, "Alice")
        }
    }

    @Test
    fun `non-collaborator caller throws IllegalArgumentException`() {
        userPort.save(UserRecord("u3", "Eve", "gh-3"))
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, listId, landmarkId, null, null, false, null, false, null, false, "Eve")
        }
    }
}

