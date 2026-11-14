package team.dedica.porthole.domain

import java.time.Instant
import java.util.UUID

/** Default hit points for every attackable building. */
const val DEFAULT_BUILDING_HEALTH = 100

enum class GamePhase {
    /** No wave running; entering a watchtower starts the game. */
    IDLE,

    /** Bugs are spawning / moving / attacking. */
    ACTIVE,

    /** Countdown until the next wave. */
    INTERMISSION,
}

/**
 * Tower-defense state attached to a [SessionState].
 *
 * @param wave           number of the current (or last completed) wave
 * @param bugs               all living bugs keyed by ID
 * @param buildingHealth     remaining health per landmark, seeded when the game starts
 * @param buildingMaxHealth  hit points a building starts with (broadcast so clients can draw bars)
 * @param towerOccupants     watchtower landmark ID -> collaborator ID currently inside
 * @param nextWaveAt         when the next wave starts during [GamePhase.INTERMISSION]
 */
data class GameState(
    val wave: Int = 0,
    val phase: GamePhase = GamePhase.IDLE,
    val bugs: MutableMap<UUID, Bug> = mutableMapOf(),
    val buildingHealth: MutableMap<UUID, Int> = mutableMapOf(),
    val buildingMaxHealth: Int = DEFAULT_BUILDING_HEALTH,
    val towerOccupants: MutableMap<UUID, UUID> = mutableMapOf(),
    val nextWaveAt: Instant? = null,
    val waveStartedAt: Instant? = null,
)
