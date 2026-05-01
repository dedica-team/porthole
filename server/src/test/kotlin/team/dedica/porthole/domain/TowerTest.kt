package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.util.UUID

class LandmarkTest {

    private val coord = HexCoordinate(0, 0)
    private val l1Id = UUID.nameUUIDFromBytes("l1".toByteArray())
    private val p1Id = UUID.nameUUIDFromBytes("p1".toByteArray())

    @Test
    fun `landmark stores all properties`() {
        val landmark = Landmark(l1Id, "Test Keep", p1Id, coord, LandmarkType.KEEP)
        assertEquals(l1Id, landmark.id)
        assertEquals("Test Keep", landmark.name)
        assertEquals(p1Id, landmark.ownerId)
        assertEquals(coord, landmark.coordinate)
        assertEquals(LandmarkType.KEEP, landmark.type)
    }

    @Test
    fun `default type is KEEP`() {
        val landmark = Landmark(l1Id, "Test", p1Id, coord)
        assertEquals(LandmarkType.KEEP, landmark.type)
    }

    @Test
    fun `copy with new type produces correct landmark`() {
        val original = Landmark(l1Id, "Test Keep", p1Id, coord, LandmarkType.KEEP)
        val changed = original.copy(type = LandmarkType.RUINS)
        assertEquals(LandmarkType.RUINS, changed.type)
        assertEquals(original.id, changed.id)
        assertEquals(original.ownerId, changed.ownerId)
    }

    @Test
    fun `all landmark types can be assigned`() {
        LandmarkType.entries.forEach { type ->
            val landmark = Landmark(l1Id, "Test", p1Id, coord, type)
            assertEquals(type, landmark.type)
        }
    }
}
