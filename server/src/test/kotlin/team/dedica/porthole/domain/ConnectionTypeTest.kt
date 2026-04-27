package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ConnectionTypeTest {

    @Test
    fun `all connection types exist`() {
        assertNotNull(ConnectionType.valueOf("PIPE"))
        assertNotNull(ConnectionType.valueOf("TELEGRAPH"))
        assertNotNull(ConnectionType.valueOf("STREET"))
        assertNotNull(ConnectionType.valueOf("ARROW"))
    }

    @Test
    fun `default connection type is PIPE`() {
        val conn = Connection(
            id = "id",
            originId = "a",
            targetId = "b",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0)),
        )
        assertEquals(ConnectionType.PIPE, conn.type)
    }

    @Test
    fun `connection with explicit TELEGRAPH type keeps the value`() {
        val conn = Connection(
            id = "id",
            originId = "a",
            targetId = "b",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0)),
            type = ConnectionType.TELEGRAPH,
        )
        assertEquals(ConnectionType.TELEGRAPH, conn.type)
    }

    @Test
    fun `connection name and description default to null`() {
        val conn = Connection(
            id = "id",
            originId = "a",
            targetId = "b",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0)),
        )
        assertNull(conn.name)
        assertNull(conn.description)
    }

    @Test
    fun `connection stores optional name and description`() {
        val conn = Connection(
            id = "id",
            originId = "a",
            targetId = "b",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0)),
            type = ConnectionType.STREET,
            name = "Main Road",
            description = "Connects north and south",
        )
        assertEquals("Main Road", conn.name)
        assertEquals("Connects north and south", conn.description)
        assertEquals(ConnectionType.STREET, conn.type)
    }
}

