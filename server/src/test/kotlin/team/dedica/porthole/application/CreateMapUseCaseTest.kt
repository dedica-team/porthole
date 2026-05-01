package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.lobby.CreateMapUseCase
import team.dedica.porthole.domain.Terrain

class CreateMapUseCaseTest {

    private lateinit var mapPort:  InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: CreateMapUseCase

    @BeforeEach
    fun setup() {
        mapPort  = InMemoryMapStatePort()
        userPort = InMemoryTestUserRepository()
        userPort.save(UserRecord(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "alice", githubId = "gh-alice"))
        useCase = CreateMapUseCase(mapPort, userPort)
    }

    // ── map types ─────────────────────────────────────────────────────────────

    @Test
    fun `LAND map has mixed terrain including water`() {
        val state = useCase.execute("alice", mapType = "LAND", mapSize = "SMALL")
        assertTrue(state.map.allTiles.any { it.terrain == Terrain.WATER })
        assertTrue(state.map.allTiles.any { it.terrain != Terrain.WATER })
    }

    @Test
    fun `SEA map has majority water tiles`() {
        val state = useCase.execute("alice", mapType = "SEA", mapSize = "SMALL")
        val tiles = state.map.allTiles
        val waterRatio = tiles.count { it.terrain == Terrain.WATER }.toDouble() / tiles.size
        assertTrue(waterRatio > 0.5, "Sea map should be mostly water, got $waterRatio")
    }

    @Test
    fun `BLANK map has only GRASS tiles`() {
        val state = useCase.execute("alice", mapType = "BLANK", mapSize = "SMALL")
        state.map.allTiles.forEach { assertEquals(Terrain.GRASS, it.terrain) }
    }

    @Test
    fun `BLANK map has no water tiles`() {
        val state = useCase.execute("alice", mapType = "BLANK", mapSize = "SMALL")
        assertTrue(state.map.allTiles.none { it.terrain == Terrain.WATER })
    }

    @Test
    fun `unknown map type falls back to LAND`() {
        val state = useCase.execute("alice", mapType = "JUNGLE", mapSize = "SMALL")
        // LAND map always has some water tiles (Perlin noise)
        assertTrue(state.map.allTiles.any { it.terrain == Terrain.WATER })
    }

    // ── map sizes ─────────────────────────────────────────────────────────────

    @Test
    fun `SMALL map has 25x25 = 625 tiles`() {
        val state = useCase.execute("alice", mapType = "BLANK", mapSize = "SMALL")
        assertEquals(625, state.map.size)
    }

    @Test
    fun `MEDIUM map has 50x50 = 2500 tiles`() {
        val state = useCase.execute("alice", mapType = "BLANK", mapSize = "MEDIUM")
        assertEquals(2500, state.map.size)
    }

    @Test
    fun `LARGE map has 80x80 = 6400 tiles`() {
        val state = useCase.execute("alice", mapType = "BLANK", mapSize = "LARGE")
        assertEquals(6400, state.map.size)
    }

    @Test
    fun `unknown size falls back to MEDIUM (2500 tiles)`() {
        val state = useCase.execute("alice", mapType = "BLANK", mapSize = "HUGE")
        assertEquals(2500, state.map.size)
    }

    @Test
    fun `default size is MEDIUM when not specified`() {
        val state = useCase.execute("alice")
        assertEquals(2500, state.map.size)
    }

    // ── combinations ──────────────────────────────────────────────────────────

    @Test
    fun `LAND SMALL combination produces 625 tiles`() {
        val state = useCase.execute("alice", mapType = "LAND", mapSize = "SMALL")
        assertEquals(625, state.map.size)
    }

    @Test
    fun `SEA LARGE combination produces 6400 tiles`() {
        val state = useCase.execute("alice", mapType = "SEA", mapSize = "LARGE")
        assertEquals(6400, state.map.size)
    }

    // ── collaborator ──────────────────────────────────────────────────────────

    @Test
    fun `creator is added as collaborator`() {
        val state = useCase.execute("alice", mapType = "BLANK", mapSize = "SMALL")
        assertEquals(1, state.collaborators.size)
        assertEquals("alice", state.collaborators.first().username)
    }

    @Test
    fun `state is persisted`() {
        val state = useCase.execute("alice", mapType = "BLANK", mapSize = "SMALL")
        assertNotNull(mapPort.findById(state.id))
    }

    @Test
    fun `unknown user throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute("nobody", mapType = "BLANK", mapSize = "SMALL")
        }
    }
}

