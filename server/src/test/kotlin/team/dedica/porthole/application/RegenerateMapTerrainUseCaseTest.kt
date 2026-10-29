package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.landscaping.RegenerateMapTerrainUseCase
import team.dedica.porthole.domain.*
import java.util.UUID

class RegenerateMapTerrainUseCaseTest {

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var broadcastPort: TestBroadcastPort
    private lateinit var useCase: RegenerateMapTerrainUseCase

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("collab1".toByteArray()), username = "Alice")
    private val stranger = Collaborator(id = UUID.nameUUIDFromBytes("stranger".toByteArray()), username = "Bob")

    private class TestBroadcastPort(
        private val delegate: team.dedica.porthole.application.port.BroadcastPort = NoOpBroadcastPort()
    ) : team.dedica.porthole.application.port.BroadcastPort by delegate {
        val messages = mutableListOf<Pair<UUID, SessionState>>()
        override fun send(sessionId: UUID, state: SessionState) {
            messages.add(sessionId to state)
        }
    }

    @BeforeEach
    fun setup() {
        val map = HexMap.createGrid(cols = 20, rows = 20, seed = 1L)
        state = SessionState(map = map)
        state.collaborators.add(collaborator)

        val group = LandmarkGroup(id = UUID.randomUUID(), name = "Core", color = "#ff0000")
        state.groups[group.id] = group

        val lm = Landmark(
            id = UUID.randomUUID(),
            name = "Fortress",
            coordinate = HexCoordinate(0, 0),
            groupId = group.id,
        )
        state.landmarks[lm.id] = lm

        mapStatePort = InMemorySessionStatePort()
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        mapStatePort.save(state)

        broadcastPort = TestBroadcastPort()
        useCase = RegenerateMapTerrainUseCase(mapStatePort, broadcastPort, authorizationPort)
    }

    @Test
    fun `collaborator can regenerate map terrain with new dimensions and preserve connections`() {
        val groupB = LandmarkGroup(id = UUID.randomUUID(), name = "Outpost Group", color = "#0000ff")
        state.groups[groupB.id] = groupB

        val lm2 = Landmark(
            id = UUID.randomUUID(),
            name = "Outpost",
            coordinate = HexCoordinate(5, 5),
            groupId = groupB.id,
        )
        state.landmarks[lm2.id] = lm2

        val conn = Connection(
            id = UUID.randomUUID(),
            originId = state.landmarks.values.first().id,
            targetId = lm2.id,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(5, 5)),
            name = "Supply Line",
        )
        state.connections[conn.id] = conn
        mapStatePort.save(state)

        val result = useCase.execute(state.id, collaborator.id, mapSize = "SMALL", seed = 42L)

        assertNotNull(result)
        assertEquals(25 * 25, result.map.size, "Map should be resized to SMALL (25x25)")

        // Both landmarks should have valid land coordinates
        val lm1Updated = result.landmarks[state.landmarks.values.first().id]!!
        val lm2Updated = result.landmarks[lm2.id]!!
        assertNotNull(lm1Updated.coordinate)
        assertNotNull(lm2Updated.coordinate)

        val tile1 = result.map.getTile(lm1Updated.coordinate!!)!!
        val tile2 = result.map.getTile(lm2Updated.coordinate!!)!!
        assertTrue(tile1.elevation >= 1)
        assertNotEquals(Terrain.WATER, tile1.terrain)
        assertTrue(tile2.elevation >= 1)
        assertNotEquals(Terrain.WATER, tile2.terrain)

        // Connection must be preserved with updated path connecting the new landmark coordinates
        assertEquals(1, result.connections.size)
        val updatedConn = result.connections[conn.id]!!
        assertEquals("Supply Line", updatedConn.name)
        assertEquals(lm1Updated.coordinate, updatedConn.path.first())
        assertEquals(lm2Updated.coordinate, updatedConn.path.last())

        // Verify broadcast
        assertEquals(1, broadcastPort.messages.size)
        assertEquals(state.id, broadcastPort.messages[0].first)
    }

    @Test
    fun `non-collaborator cannot regenerate terrain`() {
        assertThrows(AccessDeniedException::class.java) {
            useCase.execute(state.id, stranger.id)
        }
    }

    @Test
    fun `unknown session throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaborator.id)
        }
    }
}
