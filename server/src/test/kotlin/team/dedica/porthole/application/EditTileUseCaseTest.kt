package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.session.landscaping.EditTileUseCase
import team.dedica.porthole.domain.*

class EditTileUseCaseTest {

    private lateinit var state: MapState
    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: EditTileUseCase

    private val collaborator = Collaborator(id = "p1", username = "Alice")

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
        state = MapState(map = map)
        state.collaborators.add(collaborator)
        mapStatePort = InMemoryMapStatePort()
        mapStatePort.save(state)
        userPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p1", "Alice", "gh-1"))
        }
        useCase = EditTileUseCase(mapStatePort, userPort, NoOpBroadcastPort())
    }

    @Test
    fun `raising elevation keeps existing terrain`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), elevation = 2, terrain = null)
        val tile = result.map.getTile(HexCoordinate(0, 0))!!
        assertEquals(2, tile.elevation)
        assertEquals(Terrain.GRASS, tile.terrain) // terrain unchanged
    }

    @Test
    fun `lowering elevation to 0 keeps existing terrain`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(1, 0), elevation = 0, terrain = null)
        val tile = result.map.getTile(HexCoordinate(1, 0))!!
        assertEquals(0, tile.elevation)
        assertEquals(Terrain.GRASS, tile.terrain) // terrain unchanged
    }

    @Test
    fun `setting terrain without elevation change keeps elevation`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), elevation = null, terrain = Terrain.FOREST)
        val tile = result.map.getTile(HexCoordinate(0, 0))!!
        assertEquals(1, tile.elevation)
        assertEquals(Terrain.FOREST, tile.terrain)
    }

    @Test
    fun `setting elevation and terrain together uses explicit terrain`() {
        val result = useCase.execute(state.id, "Alice", HexCoordinate(0, 0), elevation = 3, terrain = Terrain.GRASS)
        val tile = result.map.getTile(HexCoordinate(0, 0))!!
        assertEquals(3, tile.elevation)
        assertEquals(Terrain.GRASS, tile.terrain)
    }

    @Test
    fun `invalid elevation below 0 throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", HexCoordinate(0, 0), elevation = -1, terrain = null)
        }
    }

    @Test
    fun `invalid elevation above 5 throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(state.id, "Alice", HexCoordinate(0, 0), elevation = 6, terrain = null)
        }
    }

    @Test
    fun `unknown coordinate throws`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(state.id, "Alice", HexCoordinate(99, 99), elevation = 1, terrain = null)
        }
    }

    @Test
    fun `unknown map throws`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("no-such-map", "Alice", HexCoordinate(0, 0), elevation = 1, terrain = null)
        }
    }

    @Test
    fun `non-collaborator cannot edit tile`() {
        val otherPort = InMemoryTestUserRepository().also {
            it.save(UserRecord("p2", "Bob", "gh-2"))
        }
        val uc = EditTileUseCase(mapStatePort, otherPort, NoOpBroadcastPort())
        assertThrows(IllegalArgumentException::class.java) {
            uc.execute(state.id, "Bob", HexCoordinate(0, 0), elevation = 2, terrain = null)
        }
    }
}
