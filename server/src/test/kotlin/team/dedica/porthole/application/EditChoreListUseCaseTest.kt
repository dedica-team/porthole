package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.security.access.AccessDeniedException
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.EditChoreListUseCase
import team.dedica.porthole.domain.*

class EditChoreListUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var listId: UUID
    private lateinit var editUseCase: EditChoreListUseCase
    private val lm1Uuid = UUID.nameUUIDFromBytes("lm-1".toByteArray())
    private val lm2Uuid = UUID.nameUUIDFromBytes("lm-2".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice"))
        val l1 = Landmark(id = lm1Uuid, name = "Reception", ownerId = UUID.nameUUIDFromBytes("u1".toByteArray()), type = LandmarkType.KEEP)
        val l2 = Landmark(id = lm2Uuid, name = "Surgery", ownerId = UUID.nameUUIDFromBytes("u1".toByteArray()), type = LandmarkType.KEEP)
        state.landmarks[l1.id] = l1
        state.landmarks[l2.id] = l2
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        val broadcast = NoOpBroadcastPort()
        // Create initial list with lm1
        val createUseCase = CreateChoreListUseCase(mapStatePort, broadcast, authorizationPort)
        listId = createUseCase.execute(state.id, "Old Title", listOf(lm1Uuid), null, null, collaborator.id)[0].id
        editUseCase = EditChoreListUseCase(mapStatePort, broadcast, authorizationPort)
    }

    @Test
    fun `updates title`() {
        val result = editUseCase.execute(state.id, listId, "New Title", null, null, false, null, false, collaborator.id)
        assertEquals("New Title", result[0].title)
    }

    @Test
    fun `sets and clears link`() {
        editUseCase.execute(state.id, listId, null, null, "https://wiki.example", false, null, false, collaborator.id)
        assertEquals("https://wiki.example", mapStatePort.findById(state.id)!!.choreLists[listId]!!.link)
        editUseCase.execute(state.id, listId, null, null, null, true, null, false, collaborator.id)
        assertNull(mapStatePort.findById(state.id)!!.choreLists[listId]!!.link)
    }

    @Test
    fun `sets and clears description`() {
        editUseCase.execute(state.id, listId, null, null, null, false, "My description", false, collaborator.id)
        assertEquals("My description", mapStatePort.findById(state.id)!!.choreLists[listId]!!.description)
        editUseCase.execute(state.id, listId, null, null, null, false, null, true, collaborator.id)
        assertNull(mapStatePort.findById(state.id)!!.choreLists[listId]!!.description)
    }

    @Test
    fun `blank description is stored as null`() {
        editUseCase.execute(state.id, listId, null, null, null, false, "   ", false, collaborator.id)
        assertNull(mapStatePort.findById(state.id)!!.choreLists[listId]!!.description)
    }

    @Test
    fun `adds new landmarks with NONE state`() {
        editUseCase.execute(state.id, listId, null, listOf(lm1Uuid, lm2Uuid), null, false, null, false, collaborator.id)
        val list = mapStatePort.findById(state.id)!!.choreLists[listId]!!
        assertTrue(list.entries.containsKey(lm2Uuid))
        assertEquals(ChoreEntryState.NONE, list.entries[lm2Uuid]!!.state)
    }

    @Test
    fun `removes de-selected landmarks`() {
        editUseCase.execute(state.id, listId, null, emptyList(), null, false, null, false, collaborator.id)
        val list = mapStatePort.findById(state.id)!!.choreLists[listId]!!
        assertTrue(list.entries.isEmpty())
    }

    @Test
    fun `preserves entry state for unchanged landmarks`() {
        // Manually set lm1 state to DONE
        mapStatePort.findById(state.id)!!.choreLists[listId]!!.entries[lm1Uuid]!!.state = ChoreEntryState.DONE
        mapStatePort.save(mapStatePort.findById(state.id)!!)
        // Edit keeping lm1 + adding lm2
        editUseCase.execute(state.id, listId, null, listOf(lm1Uuid, lm2Uuid), null, false, null, false, collaborator.id)
        val list = mapStatePort.findById(state.id)!!.choreLists[listId]!!
        assertEquals(ChoreEntryState.DONE, list.entries[lm1Uuid]!!.state)
    }

    @Test
    fun `ignores blank title (keeps old)`() {
        editUseCase.execute(state.id, listId, "   ", null, null, false, null, false, collaborator.id)
        val list = mapStatePort.findById(state.id)!!.choreLists[listId]!!
        assertEquals("Old Title", list.title)
    }

    @Test
    fun `non-collaborator throws AccessDeniedException`() {
        assertThrows(AccessDeniedException::class.java) {
            editUseCase.execute(state.id, listId, "Hack", null, null, false, null, false, collaborator2.id)
        }
    }

    @Test
    fun `unknown list throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            editUseCase.execute(state.id, UUID.randomUUID(), "Title", null, null, false, null, false, collaborator.id)
        }
    }

    @Test
    fun `unknown landmark throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            editUseCase.execute(state.id, listId, null, listOf(UUID.randomUUID()), null, false, null, false, collaborator.id)
        }
    }
}
