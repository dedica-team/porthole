package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.metrics.CreateUnpositionedLandmarkUseCase
import team.dedica.porthole.domain.*

class CreateUnpositionedLandmarkUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: CreateUnpositionedLandmarkUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = CreateUnpositionedLandmarkUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `creates landmark with no coordinate`() {
        val result = useCase.execute(state.id, collaborator.id, "Iron Keep")
        val lm = result.landmarks.values.firstOrNull { it.name == "Iron Keep" }
        assertNotNull(lm)
        assertNull(lm!!.coordinate)
    }

    @Test
    fun `landmark is stored with its uuid as key`() {
        val result = useCase.execute(state.id, collaborator.id, "Iron Keep")
        val lm = result.landmarks.values.firstOrNull { it.name == "Iron Keep" }
        assertNotNull(lm)
        assertTrue(result.landmarks.containsKey(lm!!.id))
    }

    @Test
    fun `name is stored correctly`() {
        val result = useCase.execute(state.id, collaborator.id, "Iron Keep")
        val lm = result.landmarks.values.firstOrNull { it.name == "Iron Keep" }
        assertNotNull(lm)
        assertEquals("Iron Keep", lm!!.name)
    }

    @Test
    fun `custom type is stored`() {
        val result = useCase.execute(state.id, collaborator.id, "Old Ruins", LandmarkType.RUINS)
        val lm = result.landmarks.values.firstOrNull { it.name == "Old Ruins" }
        assertNotNull(lm)
        assertEquals(LandmarkType.RUINS, lm!!.type)
    }

    @Test
    fun `description is stored`() {
        val result = useCase.execute(state.id, collaborator.id, "Iron Keep", description = "A sturdy keep")
        val lm = result.landmarks.values.firstOrNull { it.name == "Iron Keep" }
        assertNotNull(lm)
        assertEquals("A sturdy keep", lm!!.description)
    }

    @Test
    fun `empty name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, "")
        }
    }

    @Test
    fun `blank name fails`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, "   ")
        }
    }

    @Test
    fun `WALL type is rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, "North Wall", LandmarkType.WALL)
        }
    }

    @Test
    fun `duplicate name fails`() {
        useCase.execute(state.id, collaborator.id, "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(saved.id, collaborator.id, "Iron Keep")
        }
    }

    @Test
    fun `non-collaborator is rejected`() {
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) {
            useCase.execute(state.id, collaborator2.id, "Iron Keep")
        }
    }

    @Test
    fun `getLandmarkAt does not return unpositioned landmark`() {
        useCase.execute(state.id, collaborator.id, "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        assertNull(saved.getLandmarkAt(HexCoordinate(0, 0)))
    }
}

