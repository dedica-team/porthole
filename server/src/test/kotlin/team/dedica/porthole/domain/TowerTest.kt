package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class LandmarkTest {

    private val coord = HexCoordinate(0, 0)

    @Test
    fun `landmark stores all properties`() {
        val landmark = Landmark("l1", "Test Keep", "p1", coord, LandmarkType.KEEP)
        assertEquals("l1", landmark.id)
        assertEquals("Test Keep", landmark.name)
        assertEquals("p1", landmark.ownerId)
        assertEquals(coord, landmark.coordinate)
        assertEquals(LandmarkType.KEEP, landmark.type)
    }

    @Test
    fun `default type is KEEP`() {
        val landmark = Landmark("l1", "Test", "p1", coord)
        assertEquals(LandmarkType.KEEP, landmark.type)
    }

    @Test
    fun `copy with new type produces correct landmark`() {
        val original = Landmark("l1", "Test Keep", "p1", coord, LandmarkType.KEEP)
        val changed = original.copy(type = LandmarkType.RUINS)
        assertEquals(LandmarkType.RUINS, changed.type)
        assertEquals(original.id, changed.id)
        assertEquals(original.ownerId, changed.ownerId)
    }

    @Test
    fun `all landmark types can be assigned`() {
        LandmarkType.entries.forEach { type ->
            val landmark = Landmark("l1", "Test", "p1", coord, type)
            assertEquals(type, landmark.type)
        }
    }
}
