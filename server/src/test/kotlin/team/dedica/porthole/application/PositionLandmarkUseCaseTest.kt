package team.dedica.porthole.application
import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.landscaping.CreateConnectionUseCase
import team.dedica.porthole.application.session.landscaping.PositionLandmarkUseCase
import team.dedica.porthole.application.session.metrics.CreateUnpositionedLandmarkUseCase
import team.dedica.porthole.domain.*

class PositionLandmarkUseCaseTest {
    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice")

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var positionUseCase: PositionLandmarkUseCase
    private lateinit var createUseCase: CreateUnpositionedLandmarkUseCase
    private lateinit var createConnectionUseCase: CreateConnectionUseCase

    @BeforeEach
    fun setup() {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("p1".toByteArray()), username = "Alice"))
        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        createUseCase = CreateUnpositionedLandmarkUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        positionUseCase = PositionLandmarkUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        createConnectionUseCase = CreateConnectionUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `positions unpositioned landmark on tile`() {
        createUseCase.execute(state.id, collaborator.id, "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        val ironKeepId = saved.landmarks.values.first { it.name == "Iron Keep" }.id
        val result = positionUseCase.execute(saved.id, collaborator.id, ironKeepId, HexCoordinate(0, 0))
        val lm = result.getLandmarkAt(HexCoordinate(0, 0))
        assertNotNull(lm)
        assertEquals(HexCoordinate(0, 0), lm!!.coordinate)
    }

    @Test
    fun `relocating an already-positioned landmark succeeds`() {
        createUseCase.execute(state.id, collaborator.id, "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        val ironKeepId = saved.landmarks.values.first { it.name == "Iron Keep" }.id
        positionUseCase.execute(saved.id, collaborator.id, ironKeepId, HexCoordinate(0, 0))
        val saved2 = mapStatePort.findById(state.id)!!
        val result = positionUseCase.execute(saved2.id, collaborator.id, ironKeepId, HexCoordinate(1, 0))
        assertEquals(HexCoordinate(1, 0), result.getLandmarkAt(HexCoordinate(1, 0))?.coordinate)
        assertNull(result.getLandmarkAt(HexCoordinate(0, 0)))
    }

    @Test
    fun `relocating to same tile is a no-op and succeeds`() {
        createUseCase.execute(state.id, collaborator.id, "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        val ironKeepId = saved.landmarks.values.first { it.name == "Iron Keep" }.id
        positionUseCase.execute(saved.id, collaborator.id, ironKeepId, HexCoordinate(0, 0))
        val saved2 = mapStatePort.findById(state.id)!!
        val result = positionUseCase.execute(saved2.id, collaborator.id, ironKeepId, HexCoordinate(0, 0))
        assertEquals(HexCoordinate(0, 0), result.getLandmarkAt(HexCoordinate(0, 0))?.coordinate)
    }

    @Test
    fun `tile occupied by another landmark fails`() {
        createUseCase.execute(state.id, collaborator.id, "Iron Keep")
        val s1 = mapStatePort.findById(state.id)!!
        createUseCase.execute(s1.id, collaborator.id, "Stone Fort")
        val s2 = mapStatePort.findById(state.id)!!
        val ironKeepId = s2.landmarks.values.first { it.name == "Iron Keep" }.id
        val stoneFortId = s2.landmarks.values.first { it.name == "Stone Fort" }.id
        positionUseCase.execute(s2.id, collaborator.id, ironKeepId, HexCoordinate(0, 0))
        val s3 = mapStatePort.findById(state.id)!!
        assertThrows(IllegalArgumentException::class.java) {
            positionUseCase.execute(s3.id, collaborator.id, stoneFortId, HexCoordinate(0, 0))
        }
    }

    @Test
    fun `nonexistent landmark fails`() {
        assertThrows(NoSuchElementException::class.java) {
            positionUseCase.execute(state.id, collaborator.id, UUID.randomUUID(), HexCoordinate(0, 0))
        }
    }

    @Test
    fun `nonexistent tile fails`() {
        createUseCase.execute(state.id, collaborator.id, "Iron Keep")
        val saved = mapStatePort.findById(state.id)!!
        val ironKeepId = saved.landmarks.values.first { it.name == "Iron Keep" }.id
        assertThrows(IllegalStateException::class.java) {
            positionUseCase.execute(saved.id, collaborator.id, ironKeepId, HexCoordinate(999, 999))
        }
    }

    @Test
    fun `connection paths are recalculated after relocation`() {
        createUseCase.execute(state.id, collaborator.id, "Iron Keep")
        val s1 = mapStatePort.findById(state.id)!!
        createUseCase.execute(s1.id, collaborator.id, "Stone Fort")
        val s2 = mapStatePort.findById(state.id)!!
        val ironKeepId = s2.landmarks.values.first { it.name == "Iron Keep" }.id
        val stoneFortId = s2.landmarks.values.first { it.name == "Stone Fort" }.id
        positionUseCase.execute(s2.id, collaborator.id, ironKeepId, HexCoordinate(0, 0))
        val s3 = mapStatePort.findById(state.id)!!
        positionUseCase.execute(s3.id, collaborator.id, stoneFortId, HexCoordinate(2, 0))
        val s4 = mapStatePort.findById(state.id)!!
        createConnectionUseCase.execute(s4.id, ironKeepId, stoneFortId, callerId = collaborator.id)
        val s5 = mapStatePort.findById(state.id)!!

        val originalPath = s5.connections.values.first().path
        assertFalse(originalPath.isEmpty())

        val result = positionUseCase.execute(s5.id, collaborator.id, ironKeepId, HexCoordinate(-1, 0))

        val updatedPath = result.connections.values.first().path
        assertEquals(HexCoordinate(-1, 0), updatedPath.first())
        assertEquals(HexCoordinate(2, 0), updatedPath.last())
        assertNotEquals(originalPath, updatedPath)
    }

    @Test
    fun `repositioning landmark onto a tile reroutes third-party connections crossing that tile`() {
        createUseCase.execute(state.id, collaborator.id, "Alpha")
        val s1 = mapStatePort.findById(state.id)!!
        createUseCase.execute(s1.id, collaborator.id, "Beta")
        val s2 = mapStatePort.findById(state.id)!!
        createUseCase.execute(s2.id, collaborator.id, "Gamma")
        val s3 = mapStatePort.findById(state.id)!!
        val alphaId = s3.landmarks.values.first { it.name == "Alpha" }.id
        val betaId = s3.landmarks.values.first { it.name == "Beta" }.id
        val gammaId = s3.landmarks.values.first { it.name == "Gamma" }.id

        positionUseCase.execute(s3.id, collaborator.id, betaId, HexCoordinate(-2, 0))
        val s4 = mapStatePort.findById(state.id)!!
        positionUseCase.execute(s4.id, collaborator.id, gammaId, HexCoordinate(2, 0))
        val s5 = mapStatePort.findById(state.id)!!

        createConnectionUseCase.execute(s5.id, betaId, gammaId, callerId = collaborator.id)
        val s6 = mapStatePort.findById(state.id)!!

        val bgPath = s6.connections.values.first().path
        assertTrue(bgPath.contains(HexCoordinate(0, 0)),
            "Precondition: Beta-Gamma path must cross (0,0); got $bgPath")

        val result = positionUseCase.execute(s6.id, collaborator.id, alphaId, HexCoordinate(0, 0))

        val updatedBgPath = result.connections.values.first().path
        assertFalse(updatedBgPath.contains(HexCoordinate(0, 0)),
            "After Alpha is placed at (0,0), Beta-Gamma connection must not route through it; got $updatedBgPath")
        val ends = setOf(updatedBgPath.first(), updatedBgPath.last())
        assertTrue(ends.contains(HexCoordinate(-2, 0)), "Path must still start or end at Beta")
        assertTrue(ends.contains(HexCoordinate(2, 0)), "Path must still start or end at Gamma")
    }
}
