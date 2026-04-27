package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class MapStateTest {

    private lateinit var state: MapState
    private val collaborator1 = Collaborator(id = "p1", username = "Alice")
    private val collaborator2 = Collaborator(id = "p2", username = "Bob")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))
    }

    @Test
    fun `activeCollaborators returns all collaborators`() {
        assertEquals(2, state.collaborators.size)
    }

    @Test
    fun `getCollaborator returns correct collaborator by id`() {
        assertEquals("Alice", state.getCollaborator("p1")?.username)
    }

    @Test
    fun `getCollaborator returns null for unknown id`() {
        assertNull(state.getCollaborator("unknown"))
    }

    @Test
    fun `getLandmarksOf returns only landmarks owned by collaborator`() {
        state.landmarks["l1"] = Landmark("l1", "Landmark One", "p1", HexCoordinate(0, 0))
        state.landmarks["l2"] = Landmark("l2", "Landmark Two", "p2", HexCoordinate(1, 0))
        assertEquals(1, state.getLandmarksOf("p1").size)
        assertEquals("l1", state.getLandmarksOf("p1").first().id)
    }

    @Test
    fun `getLandmarkAt returns landmark at coordinate`() {
        val coord = HexCoordinate(0, 0)
        state.landmarks["l1"] = Landmark("l1", "Landmark One", "p1", coord)
        assertEquals("l1", state.getLandmarkAt(coord)?.id)
    }

    @Test
    fun `getLandmarkAt returns null when no landmark at coordinate`() {
        assertNull(state.getLandmarkAt(HexCoordinate(0, 0)))
    }
}
