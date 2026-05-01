package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.security.access.AccessDeniedException
import team.dedica.porthole.application.session.landscaping.EditTileUseCase
import team.dedica.porthole.domain.*

class EditTileUseCaseTest {
    private val collaborator2 = Collaborator(id = UUID.nameUUIDFromBytes("p2".toByteArray()), username = "Bob")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: EditTileUseCase

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { coord ->
            when {
                coord.q == 0 && coord.r == 0 -> 1
                coord.q == 1 && coord.r == 0 -> 2
                coord.q == 2 && coord.r == 0 -> 3
                else -> 1
            }
        })
        state = SessionState(map = map)
        state.collaborators.add(collaborator)
        mapStatePort = InMemorySessionStatePort()
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = EditTileUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `raising elevation keeps existing terrain`() {
        val result = useCase.execute(state.id, collaborator.id, HexCoordinate(0, 0), elevation = 2, terrain = null)
        val tile = result.map.getTile(HexCoordinate(0, 0))!!
        assertEquals(2, tile.elevation)
        assertEquals(Terrain.GRASS, tile.terrain) // terrain unchanged
    }

    @Test
    fun `lowering elevation to 0 keeps existing terrain`() {
        val result = useCase.execute(state.id, collaborator.id, HexCoordinate(1, 0), elevation = 0, terrain = null)
        val tile = result.map.getTile(HexCoordinate(1, 0))!!
        assertEquals(0, tile.elevation)
        assertEquals(Terrain.GRASS, tile.terrain) // terrain unchanged
    }

    @Test
    fun `setting terrain without elevation change keeps elevation`() {
        val result = useCase.execute(state.id, collaborator.id, HexCoordinate(0, 0), elevation = null, terrain = Terrain.FOREST)
        val tile = result.map.getTile(HexCoordinate(0, 0))!!
        assertEquals(1, tile.elevation)
        assertEquals(Terrain.FOREST, tile.terrain)
    }

    @Test
    fun `setting elevation and terrain together uses explicit terrain`() {
        val result = useCase.execute(state.id, collaborator.id, HexCoordinate(0, 0), elevation = 3, terrain = Terrain.GRASS)
        val tile = result.map.getTile(HexCoordinate(0, 0))!!
        assertEquals(3, tile.elevation)
        assertEquals(Terrain.GRASS, tile.terrain)
    }

    @Test
    fun `invalid elevation below 0 throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, HexCoordinate(0, 0), elevation = -1, terrain = null)
        }
    }

    @Test
    fun `invalid elevation above 5 throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, collaborator.id, HexCoordinate(0, 0), elevation = 6, terrain = null)
        }
    }

    @Test
    fun `unknown coordinate throws`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, collaborator.id, HexCoordinate(99, 99), elevation = 1, terrain = null)
        }
    }

    @Test
    fun `unknown map throws`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaborator.id, HexCoordinate(0, 0), elevation = 1, terrain = null)
        }
    }

    @Test
    fun `non-collaborator cannot edit tile`() {
        val uc = EditTileUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        assertThrows(AccessDeniedException::class.java) {
            uc.execute(state.id, collaborator2.id, HexCoordinate(0, 0), elevation = 2, terrain = null)
        }
    }
}
