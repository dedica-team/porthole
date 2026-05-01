package team.dedica.porthole.application

import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.landscaping.EditLandmarkUseCase
import team.dedica.porthole.domain.*

class EditLandmarkUseCaseTest {

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: EditLandmarkUseCase

    private val collaborator1 = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val t1Id = UUID.nameUUIDFromBytes("t1".toByteArray())
    private val g1Id = UUID.nameUUIDFromBytes("g1".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 3 })
        state = SessionState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))
        state.landmarks[t1Id] = Landmark(
            id = t1Id,
            name = "Test Keep",
            ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(0, 0),
            type = LandmarkType.KEEP
        )

        mapStatePort = InMemorySessionStatePort()
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        mapStatePort.save(state)

        useCase = EditLandmarkUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    private val t1Key get() = t1Id

    @Test
    fun `owner can change type`() {
        val result = useCase.execute(state.id, collaborator1.id, t1Id, null, LandmarkType.RUINS)
        assertEquals(LandmarkType.RUINS, result.landmarks[t1Key]!!.type)
    }

    @Test
    fun `owner can change name`() {
        val result = useCase.execute(state.id, collaborator1.id, t1Id, "New Name", null)
        assertEquals("New Name", result.landmarks[t1Key]!!.name)
    }

    @Test
    fun `owner can change both name and type`() {
        val result = useCase.execute(state.id, collaborator1.id, t1Id, "My Lighthouse", LandmarkType.LIGHTHOUSE)
        assertEquals("My Lighthouse", result.landmarks[t1Key]!!.name)
        assertEquals(LandmarkType.LIGHTHOUSE, result.landmarks[t1Key]!!.type)
    }

    @Test
    fun `passing null for both leaves landmark unchanged`() {
        val result = useCase.execute(state.id, collaborator1.id, t1Id, null, null)
        assertEquals("Test Keep", result.landmarks[t1Key]!!.name)
        assertEquals(LandmarkType.KEEP, result.landmarks[t1Key]!!.type)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator1.id, t1Id, "   ", null)
        }
    }

    @Test
    fun `non-owner collaborator can edit landmark`() {
        val result = useCase.execute(state.id, collaborator2.id, t1Id, null, LandmarkType.RUINS)
        assertEquals(LandmarkType.RUINS, result.landmarks[t1Key]?.type)
    }

    @Test
    fun `editing non-existent landmark fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, collaborator1.id, UUID.randomUUID(), null, LandmarkType.RUINS)
        }
    }

    @Test
    fun `owner can set description`() {
        val result = useCase.execute(state.id, collaborator1.id, t1Id, null, null, description = "A sturdy keep")
        assertEquals("A sturdy keep", result.landmarks[t1Key]!!.description)
    }

    @Test
    fun `blank description is stored as null`() {
        val result = useCase.execute(state.id, collaborator1.id, t1Id, null, null, description = "   ")
        assertNull(result.landmarks[t1Key]!!.description)
    }

    @Test
    fun `owner can assign landmark to a group`() {
        state.groups[g1Id] = LandmarkGroup(id = g1Id, name = "Alpha", color = "#ff0000")
        mapStatePort.save(state)
        val result = useCase.execute(state.id, collaborator1.id, t1Id, null, null, groupId = g1Id)
        assertEquals(g1Id, result.landmarks[t1Key]!!.groupId)
    }

    @Test
    fun `assigning non-existent group fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator1.id, t1Id, null, null, groupId = UUID.randomUUID())
        }
    }

    @Test
    fun `owner can clear group membership`() {
        state.groups[g1Id] = LandmarkGroup(id = g1Id, name = "Alpha", color = "#ff0000")
        state.landmarks[t1Key] = state.landmarks[t1Key]!!.copy(groupId = g1Id)
        mapStatePort.save(state)
        val result = useCase.execute(state.id, collaborator1.id, t1Id, null, null, clearGroup = true)
        assertNull(result.landmarks[t1Key]!!.groupId)
    }

    @Test
    fun `all landmark types are accepted`() {
        LandmarkType.entries.forEach { type ->
            state.landmarks[t1Key] = state.landmarks[t1Key]!!.copy(type = LandmarkType.KEEP)
            mapStatePort.save(state)
            val result = useCase.execute(state.id, collaborator1.id, t1Id, null, type)
            assertEquals(type, result.landmarks[t1Key]!!.type)
        }
    }

    @Test
    fun `owner can set a valid link`() {
        val result = useCase.execute(state.id, collaborator1.id, t1Id, null, null, link = "https://example.com")
        assertEquals("https://example.com", result.landmarks[t1Key]!!.link)
    }

    @Test
    fun `invalid link URL is rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator1.id, t1Id, null, null, link = "not-a-url")
        }
    }

    @Test
    fun `non-http link URL is rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator1.id, t1Id, null, null, link = "ftp://example.com")
        }
    }

    @Test
    fun `blank link is stored as null`() {
        val result = useCase.execute(state.id, collaborator1.id, t1Id, null, null, link = "   ")
        assertNull(result.landmarks[t1Key]!!.link)
    }

    @Test
    fun `owner can clear link with clearLink flag`() {
        state.landmarks[t1Key] = state.landmarks[t1Key]!!.copy(link = "https://example.com")
        mapStatePort.save(state)
        val result = useCase.execute(state.id, collaborator1.id, t1Id, null, null, clearLink = true)
        assertNull(result.landmarks[t1Key]!!.link)
    }
}
