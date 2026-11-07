package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.game.EnterWatchtowerUseCase
import team.dedica.porthole.application.session.game.LeaveWatchtowerUseCase
import team.dedica.porthole.application.session.game.ShootUseCase
import team.dedica.porthole.domain.AccessDeniedException
import team.dedica.porthole.domain.Bug
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.GameGeometry
import team.dedica.porthole.domain.GamePhase
import team.dedica.porthole.domain.GameState
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.Landmark
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.Vec3
import java.time.Instant
import java.util.UUID

class GameUseCasesTest {

    private val collaborator = Collaborator(id = UUID.nameUUIDFromBytes("alice".toByteArray()), username = "Alice")
    private val outsider = Collaborator(id = UUID.nameUUIDFromBytes("bob".toByteArray()), username = "Bob")

    private lateinit var state: SessionState
    private lateinit var port: InMemorySessionStatePort
    private lateinit var authorization: InMemoryAuthorizationPort
    private lateinit var tower: Landmark

    @BeforeEach
    fun setup() {
        state = SessionState(map = HexMap.createHexagonal(4), gameEnabled = true)
        state.collaborators.add(collaborator)
        tower = Landmark(
            id = UUID.randomUUID(),
            name = "Tower",
            coordinate = HexCoordinate(0, 0),
            type = LandmarkType.WATCHTOWER,
        )
        state.landmarks[tower.id] = tower
        port = InMemorySessionStatePort()
        port.save(state)
        authorization = InMemoryAuthorizationPort(port)
    }

    @Test
    fun `collaborator can enter and leave a watchtower`() {
        val enter = EnterWatchtowerUseCase(port, NoOpBroadcastPort(), authorization)
        val leave = LeaveWatchtowerUseCase(port, NoOpBroadcastPort(), authorization)

        val entered = enter.execute(state.id, collaborator.id, tower.id, Instant.parse("2026-01-01T00:00:00Z"))
        assertEquals(collaborator.id, entered.towerOccupants[tower.id])
        assertEquals(GamePhase.INTERMISSION, entered.phase)

        val left = leave.execute(state.id, collaborator.id, tower.id)
        assertFalse(left.towerOccupants.containsKey(tower.id))
    }

    @Test
    fun `non-collaborator cannot enter a watchtower`() {
        val enter = EnterWatchtowerUseCase(port, NoOpBroadcastPort(), authorization)
        assertThrows(AccessDeniedException::class.java) {
            enter.execute(state.id, outsider.id, tower.id)
        }
    }

    @Test
    fun `second collaborator cannot enter an occupied watchtower`() {
        val second = Collaborator(id = UUID.randomUUID(), username = "Carol")
        state.collaborators.add(second)
        val enter = EnterWatchtowerUseCase(port, NoOpBroadcastPort(), authorization)
        enter.execute(state.id, collaborator.id, tower.id)

        assertThrows(IllegalArgumentException::class.java) {
            enter.execute(state.id, second.id, tower.id)
        }
    }

    @Test
    fun `shooting a bug removes it from the map`() {
        val enter = EnterWatchtowerUseCase(port, NoOpBroadcastPort(), authorization)
        enter.execute(state.id, collaborator.id, tower.id)

        val bug = Bug(coordinate = HexCoordinate(2, 0))
        state.gameState = GameState(
            phase = GamePhase.ACTIVE,
            bugs = mutableMapOf(bug.id to bug),
            towerOccupants = mutableMapOf(tower.id to collaborator.id),
        )
        port.save(state)

        val target = GameGeometry.bugPosition(state, bug)
        val origin = GameGeometry.towerEyePosition(state, tower)!!
        val direction = Vec3(target.x - origin.x, target.y - origin.y, target.z - origin.z)

        val shoot = ShootUseCase(port, NoOpBroadcastPort(), authorization)
        val result = shoot.execute(state.id, collaborator.id, origin, direction)

        assertTrue(result.hit)
        assertEquals(bug.id.toString(), result.bugId)
        assertTrue(state.gameState.bugs.isEmpty())
    }

    @Test
    fun `shooting along the bug's previous tile still hits while it is visibly moving`() {
        val enter = EnterWatchtowerUseCase(port, NoOpBroadcastPort(), authorization)
        enter.execute(state.id, collaborator.id, tower.id)

        val previous = HexCoordinate(2, 1)
        val bug = Bug(coordinate = HexCoordinate(2, 0), previousCoordinate = previous)
        state.gameState = GameState(
            phase = GamePhase.ACTIVE,
            bugs = mutableMapOf(bug.id to bug),
            towerOccupants = mutableMapOf(tower.id to collaborator.id),
        )
        port.save(state)

        val visiblePosition = GameGeometry.bugPosition(state, bug.copy(coordinate = previous))
        val origin = GameGeometry.towerEyePosition(state, tower)!!
        val direction = Vec3(
            visiblePosition.x - origin.x,
            visiblePosition.y - origin.y,
            visiblePosition.z - origin.z,
        )

        val shoot = ShootUseCase(port, NoOpBroadcastPort(), authorization)
        val result = shoot.execute(state.id, collaborator.id, origin, direction)

        assertTrue(result.hit)
        assertEquals(bug.id.toString(), result.bugId)
    }

    @Test
    fun `shooting from a spoofed origin is rejected`() {
        val enter = EnterWatchtowerUseCase(port, NoOpBroadcastPort(), authorization)
        enter.execute(state.id, collaborator.id, tower.id)

        val bug = Bug(coordinate = HexCoordinate(2, 0))
        state.gameState = GameState(
            phase = GamePhase.ACTIVE,
            bugs = mutableMapOf(bug.id to bug),
            towerOccupants = mutableMapOf(tower.id to collaborator.id),
        )
        port.save(state)

        val shoot = ShootUseCase(port, NoOpBroadcastPort(), authorization)
        assertThrows(IllegalArgumentException::class.java) {
            shoot.execute(state.id, collaborator.id, Vec3(100.0, 100.0, 100.0), Vec3(1.0, 0.0, 0.0))
        }
    }

    @Test
    fun `game mechanics are rejected when the game is disabled`() {
        port.save(state.copy(gameEnabled = false))
        val enter = EnterWatchtowerUseCase(port, NoOpBroadcastPort(), authorization)
        val shoot = ShootUseCase(port, NoOpBroadcastPort(), authorization)

        assertThrows(IllegalArgumentException::class.java) {
            enter.execute(state.id, collaborator.id, tower.id)
        }
        assertThrows(IllegalArgumentException::class.java) {
            shoot.execute(state.id, collaborator.id, Vec3(0.0, 5.0, 0.0), Vec3(1.0, 0.0, 0.0))
        }
    }

    @Test
    fun `shooting without a watchtower is rejected`() {
        val bug = Bug(coordinate = HexCoordinate(2, 0))
        state.gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(bug.id to bug))
        port.save(state)

        val shoot = ShootUseCase(port, NoOpBroadcastPort(), authorization)
        assertThrows(IllegalArgumentException::class.java) {
            shoot.execute(state.id, collaborator.id, Vec3(0.0, 5.0, 0.0), Vec3(1.0, 0.0, 0.0))
        }
    }
}
