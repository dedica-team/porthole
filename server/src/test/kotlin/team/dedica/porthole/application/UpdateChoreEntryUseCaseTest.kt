package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.security.access.AccessDeniedException
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.UpdateChoreEntryUseCase
import team.dedica.porthole.domain.*

class UpdateChoreEntryUseCaseTest {
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var listId: UUID
    private lateinit var useCase: UpdateChoreEntryUseCase
    private val landmarkUuid = UUID.nameUUIDFromBytes("lm-1".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice"))
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u2".toByteArray()), username = "Bob"))
        val landmark = Landmark(id = landmarkUuid, name = "Pharmacy", ownerId = UUID.nameUUIDFromBytes("u1".toByteArray()), type = LandmarkType.KEEP)
        state.landmarks[landmark.id] = landmark
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        val broadcast = NoOpBroadcastPort()
        listId = CreateChoreListUseCase(mapStatePort, broadcast, authorizationPort)
            .execute(state.id, "Sprint", listOf(landmarkUuid), null, collaborator.id)[0].id
        useCase = UpdateChoreEntryUseCase(mapStatePort, broadcast, authorizationPort)
    }

    private fun patch(
        state: ChoreEntryState? = null,
        assigneeId: UUID? = null,
        clearAssignee: Boolean = false,
        link: String? = null,
        clearLink: Boolean = false,
        note: String? = null,
        clearNote: Boolean = false,
    ) = useCase.execute(
        mapId = this.state.id, listId = listId, landmarkId = landmarkUuid,
        state = state, assigneeId = assigneeId, clearAssignee = clearAssignee,
        link = link, clearLink = clearLink, note = note, clearNote = clearNote,
        callerId = collaborator.id,
    )

    private val lmKey get() = landmarkUuid

    @Test
    fun `sets state`() {
        patch(state = ChoreEntryState.DONE)
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[lmKey]!!
        assertEquals(ChoreEntryState.DONE, entry.state)
    }

    @Test
    fun `sets assignee when collaborator`() {
        val u2 = UUID.nameUUIDFromBytes("u2".toByteArray())
        patch(assigneeId = u2)
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[lmKey]!!
        assertEquals(u2, entry.assigneeId)
    }

    @Test
    fun `clears assignee`() {
        patch(assigneeId = UUID.nameUUIDFromBytes("u2".toByteArray()))
        patch(clearAssignee = true)
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[lmKey]!!
        assertNull(entry.assigneeId)
    }

    @Test
    fun `non-collaborator assignee throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            patch(assigneeId = UUID.nameUUIDFromBytes("outsider-id".toByteArray()))
        }
    }

    @Test
    fun `sets link`() {
        patch(link = "https://wiki.example/audit")
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[lmKey]!!
        assertEquals("https://wiki.example/audit", entry.link)
    }

    @Test
    fun `clears link`() {
        patch(link = "https://example.com")
        patch(clearLink = true)
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[lmKey]!!
        assertNull(entry.link)
    }

    @Test
    fun `sets note`() {
        patch(note = "Check the fridges")
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[lmKey]!!
        assertEquals("Check the fridges", entry.note)
    }

    @Test
    fun `clears note`() {
        patch(note = "temp note")
        patch(clearNote = true)
        val entry = mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[lmKey]!!
        assertNull(entry.note)
    }

    @Test
    fun `returns the updated chore list`() {
        val result = patch(state = ChoreEntryState.BLOCKED)
        assertEquals(listId, result.id)
        assertEquals(ChoreEntryState.BLOCKED, result.entries[lmKey]!!.state)
    }

    @Test
    fun `unknown entry throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, listId, UUID.randomUUID(), null, null, false, null, false, null, false, collaborator.id)
        }
    }

    @Test
    fun `non-collaborator caller throws AccessDeniedException`() {
        assertThrows(AccessDeniedException::class.java) {
            useCase.execute(state.id, listId, landmarkUuid, null, null, false, null, false, null, false, UUID.randomUUID())
        }
    }
}
