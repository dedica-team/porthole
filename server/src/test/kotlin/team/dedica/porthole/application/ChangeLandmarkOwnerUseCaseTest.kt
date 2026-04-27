package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.landscaping.ChangeLandmarkOwnerUseCase
import team.dedica.porthole.domain.*

class ChangeLandmarkOwnerUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var useCase: ChangeLandmarkOwnerUseCase

    private val collaborator1 = Collaborator(id = "p1", username = "Alice")
    private val collaborator2 = Collaborator(id = "p2", username = "Bob")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))
        state.landmarks["lm1"] = Landmark(id = "lm1", name = "Iron Keep", ownerId = "p1", coordinate = HexCoordinate(0, 0))
        state.landmarks["lm2"] = Landmark(id = "lm2", name = "Unowned Post", ownerId = null, coordinate = HexCoordinate(1, 0))

        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)

        val userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
            it.save(UserRecord("p2", "Bob", "gh-2"))
        }
        useCase = ChangeLandmarkOwnerUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `collaborator can assign owner to themselves`() {
        val result = useCase.execute(state.id, "Alice", "lm1", "p1")
        assertEquals("p1", result.landmarks["lm1"]!!.ownerId)
    }

    @Test
    fun `collaborator can reassign owner to another collaborator`() {
        val result = useCase.execute(state.id, "Alice", "lm1", "p2")
        assertEquals("p2", result.landmarks["lm1"]!!.ownerId)
    }

    @Test
    fun `any collaborator can change owner on unowned landmark`() {
        val result = useCase.execute(state.id, "Bob", "lm2", "p2")
        assertEquals("p2", result.landmarks["lm2"]!!.ownerId)
    }

    @Test
    fun `passing null clears the owner`() {
        val result = useCase.execute(state.id, "Alice", "lm1", null)
        assertNull(result.landmarks["lm1"]!!.ownerId)
    }

    @Test
    fun `passing blank string clears the owner`() {
        val result = useCase.execute(state.id, "Alice", "lm1", "   ")
        assertNull(result.landmarks["lm1"]!!.ownerId)
    }

    @Test
    fun `non-collaborator cannot change owner`() {
        val userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
            it.save(UserRecord("p2", "Bob", "gh-2"))
            it.save(UserRecord("p3", "Eve", "gh-3"))
        }
        val uc = ChangeLandmarkOwnerUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        assertThrows(IllegalArgumentException::class.java) {
            uc.execute(state.id, "Eve", "lm1", "p1")
        }
    }

    @Test
    fun `setting owner to non-collaborator id fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", "lm1", "unknown-user-id")
        }
    }

    @Test
    fun `unknown landmark fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Alice", "no-such-landmark", "p2")
        }
    }

    @Test
    fun `unknown caller fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Ghost", "lm1", "p2")
        }
    }

    @Test
    fun `unknown map fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-such-map", "Alice", "lm1", "p2")
        }
    }

    @Test
    fun `state is saved after owner change`() {
        useCase.execute(state.id, "Alice", "lm1", "p2")
        val saved = mapStatePort.findById(state.id)!!
        assertEquals("p2", saved.landmarks["lm1"]!!.ownerId)
    }
}

