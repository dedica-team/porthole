package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.util.UUID

class ConnectionTest {

    @Test
    fun `connection stores all properties`() {
        val id = UUID.randomUUID()
        val originId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0))
        val conn = Connection(id = id, originId = originId, targetId = targetId, path = path)
        assertEquals(id, conn.id)
        assertEquals(originId, conn.originId)
        assertEquals(targetId, conn.targetId)
        assertEquals(path, conn.path)
    }
}
