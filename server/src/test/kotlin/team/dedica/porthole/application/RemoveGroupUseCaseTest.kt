package team.dedica.porthole.application

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

    private val collaborator = Collaborator(id = "p1", username = "Alice")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        state = MapState(map = map)
        state.collaborators.add(collaborator)
        state.groups["g1"] = LandmarkGroup(id = "g1", name = "Alpha", color = "#ff0000")
        state.groups["g2"] = LandmarkGroup(id = "g2", name = "Beta",  color = "#0000ff")
        state.landmarks["lm1"] = Landmark(id = "lm1", name = "Keep One", ownerId = "p1",
            coordinate = HexCoordinate(0, 0), groupId = "g1")
        state.landmarks["lm2"] = Landmark(id = "lm2", name = "Keep Two", ownerId = "p1",
            coordinate = HexCoordinate(1, 0), groupId = "g2")
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }
        useCase = RemoveGroupUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `group is removed`() {
        val result = useCase.execute(state.id, "Alice", "g1")
        assertFalse(result.groups.containsKey("g1"))
    }

    @Test
    fun `other groups are not affected`() {
        val result = useCase.execute(state.id, "Alice", "g1")
        assertTrue(result.groups.containsKey("g2"))
    }

    @Test
    fun `landmarks that referenced the group have groupId cleared`() {
        val result = useCase.execute(state.id, "Alice", "g1")
        assertNull(result.landmarks["lm1"]!!.groupId)
    }

    @Test
    fun `landmarks in other groups are not affected`() {
        val result = useCase.execute(state.id, "Alice", "g1")
        assertEquals("g2", result.landmarks["lm2"]!!.groupId)
    }

    @Test
    fun `unknown group id fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "no-such-group")
        }
    }

    @Test
    fun `non-collaborator cannot remove group`() {
        val otherPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p2", "Bob", "gh-2"))
        }
        val uc = RemoveGroupUseCase(mapStatePort, otherPort, NoOpBroadcastPort())
        assertThrows(IllegalArgumentException::class.java) {
            uc.execute(state.id, "Bob", "g1")
        }
    }
}
