package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.domain.AccessDeniedException
import team.dedica.porthole.application.session.greenkeeping.CreateGreenkeepingRotationUseCase
import team.dedica.porthole.application.session.greenkeeping.GreenkeepingRotationCollaboratorPatch
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.LandmarkGroup
import team.dedica.porthole.domain.SessionState
import java.util.UUID

class CreateGreenkeepingRotationUseCaseTest {
    private val collaboratorId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private val collaborator2Id = UUID.nameUUIDFromBytes("u2".toByteArray())
    private val viewerId = UUID.nameUUIDFromBytes("viewer".toByteArray())
    private val groupId = UUID.nameUUIDFromBytes("g1".toByteArray())

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var broadcast: NoOpBroadcastPort
    private lateinit var useCase: CreateGreenkeepingRotationUseCase

    @BeforeEach
    fun setup() {
        state = SessionState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))
        state.collaborators += Collaborator(id = collaboratorId, username = "Alice")
        state.collaborators += Collaborator(id = collaborator2Id, username = "Bob")
        state.groups[groupId] = LandmarkGroup(id = groupId, name = "Core", color = "#00ffcc")
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        broadcast = NoOpBroadcastPort()
        useCase = CreateGreenkeepingRotationUseCase(mapStatePort, broadcast, authorizationPort)
    }

    @Test
    fun `creates a rotation with optional description and link`() {
        val result = useCase.execute(
            sessionId = state.id,
            name = " Weekly Core Duty ",
            description = "  Rotates platform stewardship  ",
            link = "https://wiki.example/greenkeeping",
            groupIds = listOf(groupId),
            collaborators = listOf(
                GreenkeepingRotationCollaboratorPatch(collaboratorId = collaboratorId),
                GreenkeepingRotationCollaboratorPatch(collaboratorId = collaborator2Id),
            ),
            callerId = collaboratorId,
        )

        assertEquals(1, result.size)
        val created = result.first()
        assertEquals("Weekly Core Duty", created.name)
        assertEquals("Rotates platform stewardship", created.description)
        assertEquals("https://wiki.example/greenkeeping", created.link)
        assertEquals(listOf(groupId), created.groupIds)
        assertEquals(listOf(collaboratorId, collaborator2Id), created.collaborators.map { it.collaboratorId })
        assertTrue(created.collaborators.none { it.done })
    }

    @Test
    fun `blank name throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id,
                "   ",
                null,
                null,
                listOf(groupId),
                listOf(GreenkeepingRotationCollaboratorPatch(collaboratorId = collaboratorId)),
                collaboratorId,
            )
        }
    }

    @Test
    fun `invalid link throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id,
                "Weekly",
                null,
                "ftp://invalid.example",
                listOf(groupId),
                listOf(GreenkeepingRotationCollaboratorPatch(collaboratorId = collaboratorId)),
                collaboratorId,
            )
        }
    }

    @Test
    fun `duplicate collaborators throw`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id,
                "Weekly",
                null,
                null,
                listOf(groupId),
                listOf(
                    GreenkeepingRotationCollaboratorPatch(collaboratorId = collaboratorId),
                    GreenkeepingRotationCollaboratorPatch(collaboratorId = collaboratorId),
                ),
                collaboratorId,
            )
        }
    }

    @Test
    fun `viewer cannot create rotation`() {
        assertThrows(AccessDeniedException::class.java) {
            useCase.execute(
                state.id,
                "Weekly",
                null,
                null,
                listOf(groupId),
                listOf(GreenkeepingRotationCollaboratorPatch(collaboratorId = collaboratorId)),
                viewerId,
            )
        }
    }
}

