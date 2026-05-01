package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.metrics.RemoveGroupUseCase
import team.dedica.porthole.domain.*

class RemoveGroupUseCaseTest {
    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: RemoveGroupUseCase

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private val g1Id = UUID.nameUUIDFromBytes("g1".toByteArray())
    private val g2Id = UUID.nameUUIDFromBytes("g2".toByteArray())
    private val lm1Id = UUID.nameUUIDFromBytes("lm1".toByteArray())
    private val lm2Id = UUID.nameUUIDFromBytes("lm2".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(collaborator)
        state.groups[g1Id] = LandmarkGroup(id = g1Id, name = "Alpha", color = "#ff0000")
        state.groups[g2Id] = LandmarkGroup(id = g2Id, name = "Beta",  color = "#0000ff")
        state.landmarks[lm1Id] = Landmark(id = lm1Id, name = "Keep One", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(0, 0), groupId = g1Id)
        state.landmarks[lm2Id] = Landmark(id = lm2Id, name = "Keep Two", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(1, 0), groupId = g2Id)
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
        }
        useCase = RemoveGroupUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `group is removed`() {
        val result = useCase.execute(state.id, "Alice", g1Id)
        assertFalse(result.groups.containsKey(g1Id))
    }

    @Test
    fun `other groups are not affected`() {
        val result = useCase.execute(state.id, "Alice", g1Id)
        assertTrue(result.groups.containsKey(g2Id))
    }

    @Test
    fun `landmarks that referenced the group have groupId cleared`() {
        val result = useCase.execute(state.id, "Alice", g1Id)
        assertNull(result.landmarks[lm1Id]!!.groupId)
    }

    @Test
    fun `landmarks in other groups are not affected`() {
        val result = useCase.execute(state.id, "Alice", g1Id)
        assertEquals(g2Id, result.landmarks[lm2Id]!!.groupId)
    }

    @Test
    fun `unknown group id fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", UUID.randomUUID())
        }
    }

    @Test
    fun `non-collaborator cannot remove group`() {
        val otherPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p2".toByteArray()), "Bob", "gh-2"))
        }
        val uc = RemoveGroupUseCase(mapStatePort, otherPort, NoOpBroadcastPort())
        assertThrows(IllegalArgumentException::class.java) {
            uc.execute(state.id, "Bob", g1Id)
        }
    }
}
