package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class CollaboratorTest {

    @Test
    fun `collaborator has id and username`() {
        val collaborator = Collaborator("p1", "Alice")
        assertEquals("p1", collaborator.id)
        assertEquals("Alice", collaborator.username)
    }
}
