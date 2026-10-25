package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.domain.AccessDeniedException
import team.dedica.porthole.application.session.greenkeeping.RemoveGreenkeepingRotationUseCase
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.GreenkeepingRotationCollaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.LandmarkGroup
import team.dedica.porthole.domain.SessionState
import java.util.UUID

class RemoveGreenkeepingRotationUseCaseTest {
    private val collaboratorId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private val collaborator2Id = UUID.nameUUIDFromBytes("u2".toByteArray())
    private val viewerId = UUID.nameUUIDFromBytes("viewer".toByteArray())
    private val groupId = UUID.nameUUIDFromBytes("g1".toByteArray())

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: RemoveGreenkeepingRotationUseCase
    private lateinit var alphaRotation: GreenkeepingRotation
    private lateinit var zuluRotation: GreenkeepingRotation

    @BeforeEach
    fun setup() {
        state = SessionState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))
        state.collaborators += Collaborator(id = collaboratorId, username = "Alice")
        state.collaborators += Collaborator(id = collaborator2Id, username = "Bob")
        state.groups[groupId] = LandmarkGroup(id = groupId, name = "Core", color = "#00ffcc")

        alphaRotation = GreenkeepingRotation(name = "Alpha Rotation").apply {
            groupIds += groupId
            collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaboratorId)
        }
        zuluRotation = GreenkeepingRotation(name = "Zulu Rotation").apply {
            groupIds += groupId
            collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaborator2Id)
        }
        state.greenkeepingRotations[alphaRotation.id] = alphaRotation
        state.greenkeepingRotations[zuluRotation.id] = zuluRotation

        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = RemoveGreenkeepingRotationUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `removes the requested rotation and returns remaining rotations sorted by name`() {
        val remaining = useCase.execute(state.id, zuluRotation.id, collaboratorId)

        assertEquals(1, remaining.size)
        assertEquals(alphaRotation.id, remaining.first().id)

        val saved = mapStatePort.findById(state.id)!!
        assertFalse(saved.greenkeepingRotations.containsKey(zuluRotation.id))
        assertTrue(saved.greenkeepingRotations.containsKey(alphaRotation.id))
    }

    @Test
    fun `unknown rotation throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, UUID.randomUUID(), collaboratorId)
        }
    }

    @Test
    fun `non collaborator throws AccessDeniedException`() {
        assertThrows(AccessDeniedException::class.java) {
            useCase.execute(state.id, alphaRotation.id, viewerId)
        }
    }

    @Test
    fun `unknown session throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), alphaRotation.id, collaboratorId)
        }
    }
}

