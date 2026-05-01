package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.util.UUID

class CollaboratorTest {

    @Test
    fun `collaborator has id and username`() {
        val collaborator = Collaborator(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice")
        assertEquals(UUID.nameUUIDFromBytes("p1".toByteArray()), collaborator.id)
        assertEquals("Alice", collaborator.username)
    }
}
