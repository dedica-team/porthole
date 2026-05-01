package team.dedica.porthole.domain
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class SessionStateTest {

    private lateinit var state: SessionState
    private val collaborator1 = Collaborator(id = UUID.randomUUID(), username = "Alice")
    private val collaborator2 = Collaborator(id = UUID.randomUUID(), username = "Bob")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 3 })
        state = SessionState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))
    }

    @Test
    fun `activeCollaborators returns all collaborators`() {
        assertEquals(2, state.collaborators.size)
    }

    @Test
    fun `getCollaborator returns correct collaborator by id`() {
        assertEquals("Alice", state.getCollaborator(collaborator1.id)?.username)
    }

    @Test
    fun `getCollaborator returns null for unknown id`() {
        assertNull(state.getCollaborator(UUID.randomUUID()))
    }

    @Test
    fun `getLandmarksOf returns only landmarks owned by collaborator`() {
        val p1Id = UUID.nameUUIDFromBytes("p1".toByteArray())
        val p2Id = UUID.nameUUIDFromBytes("p2".toByteArray())
        val l1Id = UUID.nameUUIDFromBytes("l1".toByteArray())
        val l2Id = UUID.nameUUIDFromBytes("l2".toByteArray())
        state.landmarks[l1Id] = Landmark(l1Id, "Landmark One", p1Id, HexCoordinate(0, 0))
        state.landmarks[l2Id] = Landmark(l2Id, "Landmark Two", p2Id, HexCoordinate(1, 0))
        assertEquals(1, state.getLandmarksOf(p1Id).size)
        assertEquals(l1Id, state.getLandmarksOf(p1Id).first().id)
    }

    @Test
    fun `getLandmarkAt returns landmark at coordinate`() {
        val coord = HexCoordinate(0, 0)
        val l1Id = UUID.nameUUIDFromBytes("l1".toByteArray())
        val p1Id = UUID.nameUUIDFromBytes("p1".toByteArray())
        state.landmarks[l1Id] = Landmark(l1Id, "Landmark One", p1Id, coord)
        assertEquals(l1Id, state.getLandmarkAt(coord)?.id)
    }

    @Test
    fun `getLandmarkAt returns null when no landmark at coordinate`() {
        assertNull(state.getLandmarkAt(HexCoordinate(0, 0)))
    }
}
