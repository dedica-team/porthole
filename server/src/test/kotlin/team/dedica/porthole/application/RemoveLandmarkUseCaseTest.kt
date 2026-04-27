package team.dedica.porthole.application

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

    private val collaborator1 = Collaborator(id = "p1", username = "Alice")
    private val collaborator2 = Collaborator(id = "p2", username = "Bob")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 5, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))

        state.landmarks["iron-keep"] = Landmark(id = "iron-keep", name = "Iron Keep", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        state.landmarks["stone-wall"] = Landmark(id = "stone-wall", name = "Stone Wall", ownerId = "p1", coordinate = HexCoordinate(3, 0))
        state.landmarks["bobs-post"] = Landmark(id = "bobs-post", name = "Bobs Post", ownerId = "p2", coordinate = HexCoordinate(-2, 0))
        state.map.setOwner(HexCoordinate(0, 0), "p1")
        state.map.setOwner(HexCoordinate(3, 0), "p1")
        state.map.setOwner(HexCoordinate(-2, 0), "p2")

        state.connections["c1"] = Connection(
            id = "c1", originId = "iron-keep", targetId = "stone-wall",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(3, 0)),
        )
        state.connections["c2"] = Connection(
            id = "c2", originId = "iron-keep", targetId = "bobs-post",
            path = listOf(HexCoordinate(0, 0), HexCoordinate(-1, 0), HexCoordinate(-2, 0)),
        )
        state.connections["c3"] = Connection(
            id = "c3", originId = "stone-wall", targetId = "bobs-post",
            path = listOf(HexCoordinate(3, 0), HexCoordinate(1, 0), HexCoordinate(-2, 0)),
        )

        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)

        val userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
            it.save(UserRecord("p2", "Bob", "gh-2"))
        }
        useCase = RemoveLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `owner can remove own landmark`() {
        val result = useCase.execute(state.id, "Alice", "iron-keep")
        assertNull(result.getLandmarkAt(HexCoordinate(0, 0)))
        assertFalse(result.landmarks.containsKey("iron-keep"))
    }

    @Test
    fun `removing landmark removes all its connections`() {
        val result = useCase.execute(state.id, "Alice", "iron-keep")
        assertFalse(result.connections.containsKey("c1"))
        assertFalse(result.connections.containsKey("c2"))
        assertTrue(result.connections.containsKey("c3"))
    }

    @Test
    fun `removing landmark resets tile ownership`() {
        useCase.execute(state.id, "Alice", "iron-keep")
        val saved = mapStatePort.findById(state.id)!!
        val tile = saved.map.getTile(HexCoordinate(0, 0))
        assertNull(tile?.ownerId)
    }

    @Test
    fun `non-owner collaborator can remove landmark`() {
        // Bob is a collaborator but not the owner of iron-keep — should succeed
        val result = useCase.execute(state.id, "Bob", "iron-keep")
        assertNull(result.landmarks["iron-keep"])
    }

    @Test
    fun `removing non-existent landmark fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Alice", "unknown-landmark")
        }
    }

    @Test
    fun `removing landmark from unknown map fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("unknown-map", "Alice", "iron-keep")
        }
    }

    @Test
    fun `landmark with no connections can be removed`() {
        state.connections.remove("c1")
        state.connections.remove("c2")
        mapStatePort.save(state)
        val result = useCase.execute(state.id, "Alice", "iron-keep")
        assertFalse(result.landmarks.containsKey("iron-keep"))
        assertEquals(1, result.connections.size)
    }
}
