package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.security.access.AccessDeniedException
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.domain.*

class CreateChoreListUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var broadcast: NoOpBroadcastPort
    private lateinit var useCase: CreateChoreListUseCase
    private val landmarkUuid = UUID.nameUUIDFromBytes("lm-1".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "Alice"))
        val landmark = Landmark(id = landmarkUuid, name = "Reception", ownerId = UUID.nameUUIDFromBytes("u1".toByteArray()), type = LandmarkType.KEEP)
        state.landmarks[landmark.id] = landmark
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        broadcast = NoOpBroadcastPort()
        useCase = CreateChoreListUseCase(mapStatePort, broadcast, authorizationPort)
    }

    @Test
    fun `creates a chore list and returns sorted list`() {
        val result = useCase.execute(state.id, "Audit", listOf(landmarkUuid), null, collaborator.id)
        assertEquals(1, result.size)
        assertEquals("Audit", result[0].title)
    }

    @Test
    fun `creates entry for each provided landmark`() {
        useCase.execute(state.id, "Audit", listOf(landmarkUuid), null, collaborator.id)
        val saved = mapStatePort.findById(state.id)!!
        val list = saved.choreLists.values.first()
        val key = landmarkUuid
        assertTrue(list.entries.containsKey(key))
        assertEquals(ChoreEntryState.NONE, list.entries[key]!!.state)
    }

    @Test
    fun `new list has completed=false`() {
        useCase.execute(state.id, "Audit", listOf(landmarkUuid), null, collaborator.id)
        val list = mapStatePort.findById(state.id)!!.choreLists.values.first()
        assertFalse(list.completed)
    }

    @Test
    fun `blank title throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "   ", listOf(landmarkUuid), null, collaborator.id)
        }
    }

    @Test
    fun `non-collaborator throws AccessDeniedException`() {
        assertThrows(AccessDeniedException::class.java) {
            useCase.execute(state.id, "Audit", listOf(landmarkUuid), null, collaborator2.id)
        }
    }

    @Test
    fun `unknown landmark throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Audit", listOf(UUID.randomUUID()), null, collaborator.id)
        }
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), "Audit", listOf(landmarkUuid), null, collaborator.id)
        }
    }

    @Test
    fun `returned list is sorted by title`() {
        useCase.execute(state.id, "Zebra", emptyList(), null, collaborator.id)
        val result = useCase.execute(state.id, "Alpha", emptyList(), null, collaborator.id)
        assertEquals("Alpha", result[0].title)
        assertEquals("Zebra", result[1].title)
    }

    @Test
    fun `persists the new chore list`() {
        useCase.execute(state.id, "My List", emptyList(), null, collaborator.id)
        val saved = mapStatePort.findById(state.id)!!
        assertEquals(1, saved.choreLists.size)
    }
}
