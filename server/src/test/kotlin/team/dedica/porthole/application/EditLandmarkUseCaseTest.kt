package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.landscaping.EditLandmarkUseCase
import team.dedica.porthole.domain.*

class EditLandmarkUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var useCase: EditLandmarkUseCase

    private val collaborator1 = Collaborator(id = "p1", username = "Alice")
    private val collaborator2 = Collaborator(id = "p2", username = "Bob")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))
        state.landmarks["t1"] = Landmark(id = "t1", name = "Test Keep", ownerId = "p1", coordinate = HexCoordinate(0, 0), type = LandmarkType.KEEP)

        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)

        val userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
            it.save(UserRecord("p2", "Bob", "gh-2"))
        }
        useCase = EditLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `owner can change type`() {
        val result = useCase.execute(state.id, "Alice", "t1", null, LandmarkType.RUINS)
        assertEquals(LandmarkType.RUINS, result.landmarks["t1"]!!.type)
    }

    @Test
    fun `owner can change name`() {
        val result = useCase.execute(state.id, "Alice", "t1", "New Name", null)
        assertEquals("New Name", result.landmarks["t1"]!!.name)
    }

    @Test
    fun `owner can change both name and type`() {
        val result = useCase.execute(state.id, "Alice", "t1", "My Lighthouse", LandmarkType.LIGHTHOUSE)
        assertEquals("My Lighthouse", result.landmarks["t1"]!!.name)
        assertEquals(LandmarkType.LIGHTHOUSE, result.landmarks["t1"]!!.type)
    }

    @Test
    fun `passing null for both leaves landmark unchanged`() {
        val result = useCase.execute(state.id, "Alice", "t1", null, null)
        assertEquals("Test Keep", result.landmarks["t1"]!!.name)
        assertEquals(LandmarkType.KEEP, result.landmarks["t1"]!!.type)
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "t1", "   ", null)
        }
    }

    @Test
    fun `non-owner collaborator can edit landmark`() {
        // Bob is a collaborator but not the owner of t1 — should succeed
        val result = useCase.execute(state.id, "Bob", "t1", null, LandmarkType.RUINS)
        assertEquals(LandmarkType.RUINS, result.landmarks["t1"]?.type)
    }

    @Test
    fun `editing non-existent landmark fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Alice", "unknown-id", null, LandmarkType.RUINS)
        }
    }

    @Test
    fun `owner can set description`() {
        val result = useCase.execute(state.id, "Alice", "t1", null, null, description = "A sturdy keep")
        assertEquals("A sturdy keep", result.landmarks["t1"]!!.description)
    }

    @Test
    fun `blank description is stored as null`() {
        val result = useCase.execute(state.id, "Alice", "t1", null, null, description = "   ")
        assertNull(result.landmarks["t1"]!!.description)
    }

    @Test
    fun `owner can assign landmark to a group`() {
        state.groups["g1"] = LandmarkGroup(id = "g1", name = "Alpha", color = "#ff0000")
        mapStatePort.save(state)
        val result = useCase.execute(state.id, "Alice", "t1", null, null, groupId = "g1")
        assertEquals("g1", result.landmarks["t1"]!!.groupId)
    }

    @Test
    fun `assigning non-existent group fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "t1", null, null, groupId = "missing")
        }
    }

    @Test
    fun `owner can clear group membership`() {
        state.groups["g1"] = LandmarkGroup(id = "g1", name = "Alpha", color = "#ff0000")
        state.landmarks["t1"] = state.landmarks["t1"]!!.copy(groupId = "g1")
        mapStatePort.save(state)
        val result = useCase.execute(state.id, "Alice", "t1", null, null, clearGroup = true)
        assertNull(result.landmarks["t1"]!!.groupId)
    }

    @Test
    fun `all landmark types are accepted`() {
        LandmarkType.entries.forEach { type ->
            state.landmarks["t1"] = state.landmarks["t1"]!!.copy(type = LandmarkType.KEEP)
            mapStatePort.save(state)
            val result = useCase.execute(state.id, "Alice", "t1", null, type)
            assertEquals(type, result.landmarks["t1"]!!.type)
        }
    }

    @Test
    fun `owner can set a valid link`() {
        val result = useCase.execute(state.id, "Alice", "t1", null, null, link = "https://example.com")
        assertEquals("https://example.com", result.landmarks["t1"]!!.link)
    }

    @Test
    fun `invalid link URL is rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "t1", null, null, link = "not-a-url")
        }
    }

    @Test
    fun `non-http link URL is rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "t1", null, null, link = "ftp://example.com")
        }
    }

    @Test
    fun `blank link is stored as null`() {
        val result = useCase.execute(state.id, "Alice", "t1", null, null, link = "   ")
        assertNull(result.landmarks["t1"]!!.link)
    }

    @Test
    fun `owner can clear link with clearLink flag`() {
        state.landmarks["t1"] = state.landmarks["t1"]!!.copy(link = "https://example.com")
        mapStatePort.save(state)
        val result = useCase.execute(state.id, "Alice", "t1", null, null, clearLink = true)
        assertNull(result.landmarks["t1"]!!.link)
    }
}
