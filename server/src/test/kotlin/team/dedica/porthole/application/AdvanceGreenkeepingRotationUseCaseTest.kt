package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.greenkeeping.AdvanceGreenkeepingRotationUseCase
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.GreenkeepingRotationCollaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.LandmarkGroup
import team.dedica.porthole.domain.SessionState
import java.util.UUID

class AdvanceGreenkeepingRotationUseCaseTest {
    private val collaboratorId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private val collaborator2Id = UUID.nameUUIDFromBytes("u2".toByteArray())
    private val groupId = UUID.nameUUIDFromBytes("g1".toByteArray())

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: AdvanceGreenkeepingRotationUseCase
    private lateinit var rotation: GreenkeepingRotation

    @BeforeEach
    fun setup() {
        state = SessionState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))
        state.collaborators += Collaborator(id = collaboratorId, username = "Alice")
        state.collaborators += Collaborator(id = collaborator2Id, username = "Bob")
        state.groups[groupId] = LandmarkGroup(id = groupId, name = "Core", color = "#00ffcc")
        rotation = GreenkeepingRotation(name = "Weekly")
        rotation.groupIds += groupId
        rotation.collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaboratorId)
        rotation.collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaborator2Id)
        state.greenkeepingRotations[rotation.id] = rotation
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = AdvanceGreenkeepingRotationUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `advancing marks current collaborator done`() {
        val updated = useCase.execute(state.id, rotation.id, collaboratorId)
        assertTrue(updated.collaborators[0].done)
        assertFalse(updated.collaborators[1].done)
    }

    @Test
    fun `advancing final collaborator resets all to undone`() {
        useCase.execute(state.id, rotation.id, collaboratorId)
        val updated = useCase.execute(state.id, rotation.id, collaboratorId)
        assertTrue(updated.collaborators.none { it.done })
    }

    @Test
    fun `single collaborator rotation resets immediately`() {
        val single = GreenkeepingRotation(name = "Solo")
        single.groupIds += groupId
        single.collaborators += GreenkeepingRotationCollaborator(collaboratorId = collaboratorId)
        state.greenkeepingRotations[single.id] = single
        mapStatePort.save(state)

        val updated = useCase.execute(state.id, single.id, collaboratorId)
        assertEquals(1, updated.collaborators.size)
        assertFalse(updated.collaborators[0].done)
    }
}

