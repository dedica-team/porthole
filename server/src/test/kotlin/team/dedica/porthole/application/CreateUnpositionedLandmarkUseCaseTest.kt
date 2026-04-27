package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.metrics.CreateUnpositionedLandmarkUseCase
import team.dedica.porthole.domain.*

class CreateUnpositionedLandmarkUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var useCase: CreateUnpositionedLandmarkUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "p1", username = "Alice"))
        mapStatePort = InMemoryMapStatePort().also { it.save(state) }
        val userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }
        useCase = CreateUnpositionedLandmarkUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `creates landmark with no coordinate`() {
        val result = useCase.execute(state.id, "Alice", "Iron Keep")
        val lm = result.landmarks["iron-keep"]
        assertNotNull(lm)
        assertNull(lm!!.coordinate)
    }

    @Test
    fun `slug is used as id`() {
        val result = useCase.execute(state.id, "Alice", "Iron Keep")
        assertNotNull(result.landmarks["iron-keep"])
    }

    @Test
    fun `name is stored correctly`() {
        val result = useCase.execute(state.id, "Alice", "Iron Keep")
        assertEquals("Iron Keep", result.landmarks["iron-keep"]!!.name)
    }

    @Test
    fun `custom type is stored`() {
        val result = useCase.execute(state.id, "Alice", "Old Ruins", LandmarkType.RUINS)
        assertEquals(LandmarkType.RUINS, result.landmarks["old-ruins"]!!.type)
    }

    @Test
    fun `description is stored`() {
        val result = useCase.execute(state.id, "Alice", "Iron Keep", description = "A sturdy keep")
        assertEquals("A sturdy keep", result.landmarks["iron-keep"]!!.description)
    }

    @Test
    fun `empty name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "")
        }
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "   ")
        }
    }

    @Test
    fun `WALL type is rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "North Wall", LandmarkType.WALL)
        }
    }

    @Test
    fun `duplicate slug fails`() {
        useCase.execute(state.id, "Alice", "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(saved.id, "Alice", "Iron Keep")
        }
    }

    @Test
    fun `non-collaborator is rejected`() {
        val otherUserPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p2", "Bob", "gh-2"))
        }
        val otherUseCase = CreateUnpositionedLandmarkUseCase(mapStatePort, otherUserPort, NoOpBroadcastPort())
        assertThrows(IllegalArgumentException::class.java) {
            otherUseCase.execute(state.id, "Bob", "Iron Keep")
        }
    }

    @Test
    fun `getLandmarkAt does not return unpositioned landmark`() {
        useCase.execute(state.id, "Alice", "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        assertNull(saved.getLandmarkAt(HexCoordinate(0, 0)))
    }
}

