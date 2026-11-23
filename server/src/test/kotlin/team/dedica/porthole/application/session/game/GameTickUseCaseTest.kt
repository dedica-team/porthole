package team.dedica.porthole.application.session.game

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.InMemorySessionStatePort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.domain.Bug
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.GamePhase
import team.dedica.porthole.domain.GameState
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.Landmark
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.PortholeGameProperties
import team.dedica.porthole.domain.QualityMetric
import team.dedica.porthole.domain.SessionState
import java.time.Instant
import java.util.UUID

class GameTickUseCaseTest {

    private lateinit var port: InMemorySessionStatePort
    private lateinit var recordingBroadcast: RecordingBroadcastPort
    private lateinit var properties: PortholeGameProperties
    private lateinit var useCase: GameTickUseCase

    private class RecordingBroadcastPort : BroadcastPort {
        val gameBroadcasts = mutableListOf<Pair<UUID, GameState>>()
        val fullStateBroadcasts = mutableListOf<Pair<UUID, SessionState>>()

        override fun send(sessionId: UUID, state: SessionState) {
            fullStateBroadcasts.add(sessionId to state)
        }

        override fun sendGame(sessionId: UUID, gameState: GameState) {
            gameBroadcasts.add(sessionId to gameState)
        }

        override fun sendMatrix(sessionId: UUID, matrix: CollaboratorMatrix) {}
        override fun sendMetrics(sessionId: UUID, metrics: Map<UUID, QualityMetric>) {}
        override fun sendChoreLists(sessionId: UUID, choreLists: Map<UUID, ChoreList>) {}
        override fun sendProcesses(sessionId: UUID) {}
        override fun sendGreenkeepingRotations(sessionId: UUID, rotations: Map<UUID, GreenkeepingRotation>) {}
    }

    @BeforeEach
    fun setup() {
        port = InMemorySessionStatePort()
        recordingBroadcast = RecordingBroadcastPort()
        properties = PortholeGameProperties()
        useCase = GameTickUseCase(port, recordingBroadcast, properties)
    }

    @Test
    fun `skips session when game is disabled`() {
        val state = SessionState(map = HexMap.createHexagonal(3), gameEnabled = false)
        port.save(state)

        useCase.tick(Instant.parse("2026-01-01T00:00:00Z"))

        assertTrue(recordingBroadcast.gameBroadcasts.isEmpty())
        assertTrue(recordingBroadcast.fullStateBroadcasts.isEmpty())
    }

    @Test
    fun `ticks active game session and broadcasts game state`() {
        val state = SessionState(map = HexMap.createHexagonal(3), gameEnabled = true)
        val bug = Bug(coordinate = HexCoordinate(1, 0))
        state.gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(bug.id to bug))
        port.save(state)

        useCase.tick(Instant.parse("2026-01-01T00:00:00Z"))

        assertEquals(1, recordingBroadcast.gameBroadcasts.size)
        assertEquals(state.id, recordingBroadcast.gameBroadcasts.first().first)
        assertTrue(recordingBroadcast.fullStateBroadcasts.isEmpty())
    }

    @Test
    fun `broadcasts full session state when a landmark is destroyed into ruins`() {
        val state = SessionState(map = HexMap.createHexagonal(3), gameEnabled = true)
        val target = Landmark(
            id = UUID.randomUUID(),
            name = "Keep",
            coordinate = HexCoordinate(1, 0),
            type = LandmarkType.KEEP,
        )
        state.landmarks[target.id] = target
        val bug = Bug(coordinate = HexCoordinate(0, 0))
        state.gameState = GameState(
            phase = GamePhase.ACTIVE,
            bugs = mutableMapOf(bug.id to bug),
            buildingHealth = mutableMapOf(target.id to 1),
        )
        port.save(state)

        useCase.tick(Instant.parse("2026-01-01T00:00:00Z"))

        assertEquals(1, recordingBroadcast.gameBroadcasts.size)
        assertEquals(1, recordingBroadcast.fullStateBroadcasts.size)
        assertEquals(LandmarkType.RUINS, port.findById(state.id)!!.landmarks[target.id]!!.type)
    }
}
