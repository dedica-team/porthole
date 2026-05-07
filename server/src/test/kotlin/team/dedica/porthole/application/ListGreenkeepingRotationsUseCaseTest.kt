package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.greenkeeping.ListGreenkeepingRotationsUseCase
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState
import java.util.UUID

class ListGreenkeepingRotationsUseCaseTest {
    private val collaboratorId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private val viewerId = UUID.nameUUIDFromBytes("viewer".toByteArray())

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: ListGreenkeepingRotationsUseCase

    @BeforeEach
    fun setup() {
        state = SessionState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))
        state.collaborators += Collaborator(id = collaboratorId, username = "Alice")
        state.greenkeepingRotations[UUID.nameUUIDFromBytes("rot-z".toByteArray())] = GreenkeepingRotation(name = "zulu")
        state.greenkeepingRotations[UUID.nameUUIDFromBytes("rot-a".toByteArray())] = GreenkeepingRotation(name = "Alpha")
        state.greenkeepingRotations[UUID.nameUUIDFromBytes("rot-b".toByteArray())] = GreenkeepingRotation(name = "beta")

        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = ListGreenkeepingRotationsUseCase(authorizationPort)
    }

    @Test
    fun `returns all rotations sorted case insensitively by name`() {
        val result = useCase.execute(state.id, collaboratorId)

        assertEquals(listOf("Alpha", "beta", "zulu"), result.map { it.name })
    }

    @Test
    fun `viewer can list rotations`() {
        val result = useCase.execute(state.id, viewerId)

        assertEquals(3, result.size)
    }

    @Test
    fun `returns empty list when no rotations exist`() {
        state.greenkeepingRotations.clear()
        mapStatePort.save(state)

        val result = useCase.execute(state.id, collaboratorId)

        assertTrue(result.isEmpty())
    }

    @Test
    fun `unknown session throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaboratorId)
        }
    }
}

