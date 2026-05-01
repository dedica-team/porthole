package team.dedica.porthole.application

import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.landscaping.RemoveLandmarkUseCase
import team.dedica.porthole.domain.*

class RemoveLandmarkUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var useCase: RemoveLandmarkUseCase

    private val collaborator1 = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val ironKeepId = UUID.nameUUIDFromBytes("iron-keep".toByteArray())
    private val stoneWallId = UUID.nameUUIDFromBytes("stone-wall".toByteArray())
    private val bobsPostId = UUID.nameUUIDFromBytes("bobs-post".toByteArray())
    private val c1id = UUID.nameUUIDFromBytes("c1".toByteArray())
    private val c2id = UUID.nameUUIDFromBytes("c2".toByteArray())
    private val c3id = UUID.nameUUIDFromBytes("c3".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))

        state.landmarks[ironKeepId] = Landmark(
            id = ironKeepId,
            name = "Iron Keep",
            ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(0, 0)
        )
        state.landmarks[stoneWallId] = Landmark(
            id = stoneWallId,
            name = "Stone Wall",
            ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(3, 0)
        )
        state.landmarks[bobsPostId] = Landmark(
            id = bobsPostId,
            name = "Bobs Post",
            ownerId = UUID.nameUUIDFromBytes("p2".toByteArray()),
            coordinate = HexCoordinate(-2, 0)
        )

        state.connections[c1id] = Connection(
            id = c1id, originId = ironKeepId, targetId = stoneWallId,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(3, 0))
        )
        state.connections[c2id] = Connection(
            id = c2id, originId = ironKeepId, targetId = bobsPostId,
            path = listOf(HexCoordinate(0, 0), HexCoordinate(-1, 0), HexCoordinate(-2, 0))
        )
        state.connections[c3id] = Connection(
            id = c3id, originId = stoneWallId, targetId = bobsPostId,
            path = listOf(HexCoordinate(3, 0), HexCoordinate(1, 0), HexCoordinate(-2, 0))
        )

        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)

        val userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
            it.save(UserRecord(UUID.nameUUIDFromBytes("p2".toByteArray()), "Bob", "gh-2"))
        }
        useCase = RemoveLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `owner can remove own landmark`() {
        val result = useCase.execute(state.id, "Alice", ironKeepId)
        assertNull(result.getLandmarkAt(HexCoordinate(0, 0)))
        assertFalse(result.landmarks.containsKey(ironKeepId))
    }

    @Test
    fun `removing landmark removes all its connections`() {
        val result = useCase.execute(state.id, "Alice", ironKeepId)
        assertFalse(result.connections.containsKey(c1id))
        assertFalse(result.connections.containsKey(c2id))
        assertTrue(result.connections.containsKey(c3id))
    }

    @Test
    fun `non-owner collaborator can remove landmark`() {
        val result = useCase.execute(state.id, "Bob", ironKeepId)
        assertNull(result.landmarks[ironKeepId])
    }

    @Test
    fun `removing non-existent landmark fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Alice", UUID.randomUUID())
        }
    }

    @Test
    fun `removing landmark from unknown map fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), "Alice", ironKeepId)
        }
    }

    @Test
    fun `landmark with no connections can be removed`() {
        state.connections.remove(c1id)
        state.connections.remove(c2id)
        mapStatePort.save(state)
        val result = useCase.execute(state.id, "Alice", ironKeepId)
        assertFalse(result.landmarks.containsKey(ironKeepId))
        assertEquals(1, result.connections.size)
    }
}
