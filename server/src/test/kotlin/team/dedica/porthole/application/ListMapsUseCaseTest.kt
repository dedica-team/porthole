package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.lobby.ListMapsUseCase
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState

class ListMapsUseCaseTest {

    private val userId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var useCase: ListMapsUseCase

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        useCase = ListMapsUseCase(mapStatePort)
    }

    private fun map(mode: CollaborationMode, collaboratorId: UUID? = null): SessionState {
        val s = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }), collaborationMode = mode)
        if (collaboratorId != null) s.collaborators.add(Collaborator(id = collaboratorId, username = "user"))
        mapStatePort.save(s)
        return s
    }

    @Test
    fun `returns open maps without callerId`() {
        map(CollaborationMode.OPEN)
        assertEquals(1, useCase.execute().size)
    }

    @Test
    fun `returns request maps without callerId`() {
        map(CollaborationMode.REQUEST)
        assertEquals(1, useCase.execute().size)
    }

    @Test
    fun `hides private maps from non-collaborator`() {
        map(CollaborationMode.PRIVATE)
        assertEquals(0, useCase.execute(callerId = UUID.randomUUID()).size)
    }

    @Test
    fun `shows private map to collaborator`() {
        map(CollaborationMode.PRIVATE, collaboratorId = userId)
        assertEquals(1, useCase.execute(callerId = userId).size)
    }

    @Test
    fun `hides private map when no callerId`() {
        map(CollaborationMode.PRIVATE)
        assertEquals(0, useCase.execute().size)
    }

    @Test
    fun `returns all non-private maps`() {
        map(CollaborationMode.OPEN)
        map(CollaborationMode.REQUEST)
        map(CollaborationMode.PRIVATE)
        assertEquals(2, useCase.execute().size)
    }
}

