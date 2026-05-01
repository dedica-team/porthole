package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.security.access.AccessDeniedException
import team.dedica.porthole.application.session.metrics.RemoveGroupUseCase
import team.dedica.porthole.domain.*

class RemoveGroupUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: RemoveGroupUseCase

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private val g1Id = UUID.nameUUIDFromBytes("g1".toByteArray())
    private val g2Id = UUID.nameUUIDFromBytes("g2".toByteArray())
    private val lm1Id = UUID.nameUUIDFromBytes("lm1".toByteArray())
    private val lm2Id = UUID.nameUUIDFromBytes("lm2".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = SessionState(map = map)
        state.collaborators.add(collaborator)
        state.groups[g1Id] = LandmarkGroup(id = g1Id, name = "Alpha", color = "#ff0000")
        state.groups[g2Id] = LandmarkGroup(id = g2Id, name = "Beta",  color = "#0000ff")
        state.landmarks[lm1Id] = Landmark(id = lm1Id, name = "Keep One", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(0, 0), groupId = g1Id)
        state.landmarks[lm2Id] = Landmark(id = lm2Id, name = "Keep Two", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(1, 0), groupId = g2Id)
        mapStatePort = InMemorySessionStatePort()
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = RemoveGroupUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `group is removed`() {
        val result = useCase.execute(state.id, collaborator.id, g1Id)
        assertFalse(result.groups.containsKey(g1Id))
    }

    @Test
    fun `other groups are not affected`() {
        val result = useCase.execute(state.id, collaborator.id, g1Id)
        assertTrue(result.groups.containsKey(g2Id))
    }

    @Test
    fun `landmarks that referenced the group have groupId cleared`() {
        val result = useCase.execute(state.id, collaborator.id, g1Id)
        assertNull(result.landmarks[lm1Id]!!.groupId)
    }

    @Test
    fun `landmarks in other groups are not affected`() {
        val result = useCase.execute(state.id, collaborator.id, g1Id)
        assertEquals(g2Id, result.landmarks[lm2Id]!!.groupId)
    }

    @Test
    fun `unknown group id fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, UUID.randomUUID())
        }
    }

    @Test
    fun `non-collaborator cannot remove group`() {
        val uc = RemoveGroupUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        assertThrows(AccessDeniedException::class.java) {
            uc.execute(state.id, collaborator2.id, g1Id)
        }
    }
}
