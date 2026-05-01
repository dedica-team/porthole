package team.dedica.porthole.application

import java.util.UUID

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

    private val collaborator1 = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val lm1Id = UUID.nameUUIDFromBytes("lm1".toByteArray())
    private val lm2Id = UUID.nameUUIDFromBytes("lm2".toByteArray())

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 3 })
        state = MapState(map = map)
        state.collaborators.addAll(listOf(collaborator1, collaborator2))
        state.landmarks[lm1Id] = Landmark(
            id = lm1Id,
            name = "Iron Keep",
            ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(0, 0)
        )
        state.landmarks[lm2Id] =
            Landmark(id = lm2Id, name = "Unowned Post", ownerId = null, coordinate = HexCoordinate(1, 0))

        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)

        val userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
            it.save(UserRecord(UUID.nameUUIDFromBytes("p2".toByteArray()), "Bob", "gh-2"))
        }
        useCase = ChangeLandmarkOwnerUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `collaborator can assign owner to themselves`() {
        val result = useCase.execute(state.id, "Alice", lm1Id, UUID.nameUUIDFromBytes("p1".toByteArray()))
        assertEquals(UUID.nameUUIDFromBytes("p1".toByteArray()), result.landmarks[lm1Id]!!.ownerId)
    }

    @Test
    fun `collaborator can reassign owner to another collaborator`() {
        val result = useCase.execute(state.id, "Alice", lm1Id, UUID.nameUUIDFromBytes("p2".toByteArray()))
        assertEquals(UUID.nameUUIDFromBytes("p2".toByteArray()), result.landmarks[lm1Id]!!.ownerId)
    }

    @Test
    fun `any collaborator can change owner on unowned landmark`() {
        val result = useCase.execute(state.id, "Bob", lm2Id, UUID.nameUUIDFromBytes("p2".toByteArray()))
        assertEquals(UUID.nameUUIDFromBytes("p2".toByteArray()), result.landmarks[lm2Id]!!.ownerId)
    }

    @Test
    fun `passing null clears the owner`() {
        val result = useCase.execute(state.id, "Alice", lm1Id, null)
        assertNull(result.landmarks[lm1Id]!!.ownerId)
    }

    @Test
    fun `non-collaborator cannot change owner`() {
        val userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord(UUID.nameUUIDFromBytes("p1".toByteArray()), "Alice", "gh-1"))
            it.save(UserRecord(UUID.nameUUIDFromBytes("p2".toByteArray()), "Bob", "gh-2"))
            it.save(UserRecord(UUID.nameUUIDFromBytes("p3".toByteArray()), "Eve", "gh-3"))
        }
        val uc = ChangeLandmarkOwnerUseCase(mapStatePort, userPort, NoOpBroadcastPort())
        assertThrows(IllegalArgumentException::class.java) {
            uc.execute(state.id, "Eve", lm1Id, UUID.nameUUIDFromBytes("p1".toByteArray()))
        }
    }

    @Test
    fun `setting owner to non-collaborator id fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", lm1Id, UUID.randomUUID())
        }
    }

    @Test
    fun `unknown landmark fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Alice", UUID.randomUUID(), UUID.nameUUIDFromBytes("p2".toByteArray()))
        }
    }

    @Test
    fun `unknown caller fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Ghost", lm1Id, UUID.nameUUIDFromBytes("p2".toByteArray()))
        }
    }

    @Test
    fun `unknown map fails`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), "Alice", lm1Id, UUID.nameUUIDFromBytes("p2".toByteArray()))
        }
    }

    @Test
    fun `state is saved after owner change`() {
        useCase.execute(state.id, "Alice", lm1Id, UUID.nameUUIDFromBytes("p2".toByteArray()))
        val saved = mapStatePort.findById(state.id)!!
        assertEquals(UUID.nameUUIDFromBytes("p2".toByteArray()), saved.landmarks[lm1Id]!!.ownerId)
    }
}
