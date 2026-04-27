package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ConnectionTest {

    @Test
    fun `connection stores all properties`() {
        val path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0))
        val conn = Connection(id = "c1", originId = "t1", targetId = "t2", path = path)
        assertEquals("c1", conn.id)
        assertEquals("t1", conn.originId)
        assertEquals("t2", conn.targetId)
        assertEquals(path, conn.path)
    }
}

