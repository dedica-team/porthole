package team.dedica.porthole.domain

import java.time.Duration
import java.time.Instant
import java.util.Random
import java.util.UUID

/**
 * Deterministic, server-side tower-defense simulation.
 *
 * The engine is intentionally free of persistence and transport concerns so it can be
 * unit-tested directly. Callers (use cases / scheduler) own saving and broadcasting.
 */
object GameEngine {
    const val BUILDING_HEALTH = DEFAULT_BUILDING_HEALTH
    const val WAVE_INTERMISSION_PERIOD = "PT1H"
    const val FIRST_WAVE_DELAY_SECONDS = 3L
    const val BUGS_BASE = 2
    const val MAX_BUGS_PER_WAVE = 12

    /**
     * Parses an ISO-8601 period/duration string (e.g. "PT1H", "PT20S", "P1D") or shorthand
     * format (e.g. "1h", "20s", "30m", "1d"), defaulting to one hour ("PT1H") if null/invalid.
     */
    fun parsePeriod(period: String?): Duration {
        if (period.isNullOrBlank()) {
            return Duration.parse(WAVE_INTERMISSION_PERIOD)
        }
        val trimmed = period.trim()
        try {
            return Duration.parse(trimmed)
        } catch (_: Exception) {
        }
        try {
            return Duration.parse("PT${trimmed.uppercase()}")
        } catch (_: Exception) {
        }
        val match = Regex("""^(\d+)\s*([a-zA-Z]+)?$""").matchEntire(trimmed)
        if (match != null) {
            val (amountStr, unitStr) = match.destructured
            val amount = amountStr.toLongOrNull() ?: 1L
            return when (unitStr.lowercase()) {
                "s", "sec", "secs", "second", "seconds" -> Duration.ofSeconds(amount)
                "m", "min", "mins", "minute", "minutes" -> Duration.ofMinutes(amount)
                "h", "hr", "hrs", "hour", "hours" -> Duration.ofHours(amount)
                "d", "day", "days" -> Duration.ofDays(amount)
                "w", "week", "weeks" -> Duration.ofDays(amount * 7)
                "", "ms", "millis" -> if (unitStr.isEmpty()) Duration.ofSeconds(amount) else Duration.ofMillis(amount)
                else -> Duration.parse(WAVE_INTERMISSION_PERIOD)
            }
        }
        return Duration.parse(WAVE_INTERMISSION_PERIOD)
    }

    /** Arms the game when a collaborator enters a watchtower for the first time. */
    fun start(state: SessionState, now: Instant): GameState {
        val game = state.gameState
        if (!state.gameEnabled) {
            return game
        }

        return when (game.phase) {
            GamePhase.ACTIVE -> game
            GamePhase.IDLE -> game.copy(
                phase = GamePhase.INTERMISSION,
                nextWaveAt = now.plusSeconds(FIRST_WAVE_DELAY_SECONDS),
                buildingHealth = initialBuildingHealth(state, game),
            )
            GamePhase.INTERMISSION -> game
        }
    }

    /**
     * Advances the simulation by one tick.
     *
     * @return true when [state] was mutated and should be persisted/broadcast.
     */
    fun tick(
        state: SessionState,
        now: Instant = Instant.now(),
        random: Random = Random(),
        defaultIntermissionPeriod: String = WAVE_INTERMISSION_PERIOD,
    ): Boolean {
        if (!state.gameEnabled) return false
        var game = state.gameState
        if (game.phase == GamePhase.IDLE) return false

        var changed = false

        if (game.phase == GamePhase.INTERMISSION) {
            val next = game.nextWaveAt
            if (next == null || !now.isBefore(next)) {
                game = spawnWave(state, game, now, random, defaultIntermissionPeriod)
                changed = true
            }
        }

        if (game.phase == GamePhase.ACTIVE) {
            val snapshot = game.bugs.values.toList()
            snapshot.forEach { bug -> stepBug(state, game, bug, random) }
            changed = changed || snapshot.isNotEmpty()

            if (game.bugs.isEmpty()) {
                val period = state.waveIntermissionPeriod ?: defaultIntermissionPeriod
                val duration = parsePeriod(period)
                game = game.copy(
                    phase = GamePhase.INTERMISSION,
                    nextWaveAt = now.plus(duration),
                )
                changed = true
            }
        }

        if (changed) state.gameState = game
        return changed
    }

    /**
     * Spawns crawlers on unblocked terrain tiles adjacent to landmarks with an ERROR metric rollup.
     * Crawlers never spawn on coordinates occupied by buildings or walls.
     */
    fun spawnCoordinates(state: SessionState): List<HexCoordinate> {
        val occupied = blockedCoordinates(state)
        val errorLandmarkCoords = state.landmarks.values
            .filter { landmark ->
                landmark.coordinate != null &&
                    landmark.metrics.values.any { it.level == QualityLevel.ERROR }
            }
            .mapNotNull { it.coordinate }
            .distinct()
            .filter { state.map.getTile(it) != null }

        return errorLandmarkCoords.flatMap { coord ->
            val freeNeighbours = coord.neighbours().filter { n ->
                state.map.getTile(n) != null && n !in occupied
            }
            if (freeNeighbours.isNotEmpty()) {
                freeNeighbours
            } else {
                val freeRange2 = coord.neighbours()
                    .flatMap { it.neighbours() }
                    .distinct()
                    .filter { n -> state.map.getTile(n) != null && n !in occupied }
                if (freeRange2.isNotEmpty()) {
                    freeRange2
                } else {
                    val anyFree = state.map.allTiles
                        .filter { it.coordinate !in occupied }
                        .map { it.coordinate }
                    anyFree.ifEmpty { coord.neighbours().filter { state.map.getTile(it) != null } }
                }
            }
        }.distinct()
    }

    private fun spawnWave(
        state: SessionState,
        game: GameState,
        now: Instant,
        random: Random,
        defaultIntermissionPeriod: String = WAVE_INTERMISSION_PERIOD,
    ): GameState {
        val spawns = spawnCoordinates(state)
        if (spawns.isEmpty()) {
            val period = state.waveIntermissionPeriod ?: defaultIntermissionPeriod
            val duration = parsePeriod(period)
            return game.copy(
                phase = GamePhase.INTERMISSION,
                nextWaveAt = now.plus(duration),
            )
        }

        val wave = game.wave + 1
        val count = (BUGS_BASE + wave).coerceAtMost(MAX_BUGS_PER_WAVE)
        repeat(count) { index ->
            val coordinate = spawns[(index + random.nextInt(spawns.size)) % spawns.size]
            val bug = Bug(coordinate = coordinate, spawnCoordinate = coordinate, spawnedAt = now)
            game.bugs[bug.id] = bug
        }
        return game.copy(
            wave = wave,
            phase = GamePhase.ACTIVE,
            nextWaveAt = null,
            waveStartedAt = now,
        )
    }

    private fun stepBug(
        state: SessionState,
        game: GameState,
        bug: Bug,
        random: Random,
    ) {
        // Crawlers must stay within map boundaries; prune any bug whose position is off-map.
        if (state.map.getTile(bug.coordinate) == null) {
            game.bugs.remove(bug.id)
            return
        }

        val targetId = resolveTarget(state, game, bug)
        val targetCoordinate = targetId?.let { state.landmarks[it]?.coordinate }
        if (targetId == null || targetCoordinate == null || state.map.getTile(targetCoordinate) == null) {
            wander(state, game, bug, random)
            return
        }

        if (bug.coordinate.distanceTo(targetCoordinate) <= 1) {
            val remaining = ((game.buildingHealth[targetId] ?: game.buildingMaxHealth) - 1).coerceAtLeast(0)
            game.buildingHealth[targetId] = remaining
            if (remaining == 0) destroyBuilding(state, game, targetId)
            // Standing still to attack: drop the stale movement trail so shots no
            // longer count at the tile the bug arrived from.
            game.bugs[bug.id] = bug.copy(targetLandmarkId = targetId, previousCoordinate = null)
            return
        }

        // Bugs must walk around buildings and walls; only the tile adjacent to the
        // current target is reachable, the target itself is never entered.
        val blocked = blockedCoordinates(state, except = setOf(targetCoordinate))
        val path = AStarPathfinder.findPath(state.map, bug.coordinate, targetCoordinate, blocked)
        val next = path?.getOrNull(1)
        if (next == null || state.map.getTile(next) == null) {
            wander(state, game, bug, random)
            return
        }
        game.bugs[bug.id] = bug.copy(
            coordinate = next,
            previousCoordinate = bug.coordinate,
            targetLandmarkId = targetId,
        )
    }

    private fun resolveTarget(state: SessionState, game: GameState, bug: Bug): UUID? {
        val isAlive = { landmark: Landmark ->
            isAttackable(landmark, state.map) &&
                (game.buildingHealth[landmark.id] ?: game.buildingMaxHealth) > 0
        }
        val current = bug.targetLandmarkId
            ?.let { state.landmarks[it] }
            ?.takeIf { isAlive(it) }
        if (current != null) return current.id

        return state.landmarks.values
            .asSequence()
            .filter { isAlive(it) && it.coordinate != bug.coordinate && state.map.getTile(it.coordinate!!) != null }
            .minByOrNull { bug.coordinate.distanceTo(it.coordinate!!) }
            ?.id
    }

    private fun wander(
        state: SessionState,
        game: GameState,
        bug: Bug,
        random: Random,
    ) {
        val occupied = blockedCoordinates(state)
        val freeNeighbours = state.map.getNeighbours(bug.coordinate)
            .filter { it.coordinate !in occupied && state.map.getTile(it.coordinate) != null }
        if (freeNeighbours.isEmpty()) {
            game.bugs[bug.id] = bug.copy(previousCoordinate = null)
            return
        }
        val next = freeNeighbours[random.nextInt(freeNeighbours.size)].coordinate
        if (state.map.getTile(next) == null) {
            game.bugs[bug.id] = bug.copy(previousCoordinate = null)
            return
        }
        game.bugs[bug.id] = bug.copy(coordinate = next, previousCoordinate = bug.coordinate)
    }

    /** Buildings are attackable landmarks; walls and existing ruins are obstacles only. */
    fun isAttackable(landmark: Landmark, map: HexMap? = null): Boolean =
        landmark.coordinate != null &&
            (map == null || map.getTile(landmark.coordinate) != null) &&
            landmark.type != LandmarkType.WALL &&
            landmark.type != LandmarkType.RUINS

    private fun initialBuildingHealth(state: SessionState, game: GameState): MutableMap<UUID, Int> {
        val health = game.buildingHealth.toMutableMap()
        state.landmarks.values
            .filter { isAttackable(it, state.map) }
            .forEach { health.putIfAbsent(it.id, game.buildingMaxHealth) }
        return health
    }

    /** All tiles occupied by a landmark (buildings and walls) are impassable. */
    private fun blockedCoordinates(
        state: SessionState,
        except: Set<HexCoordinate> = emptySet(),
    ): Set<HexCoordinate> =
        state.landmarks.values
            .mapNotNull { it.coordinate }
            .filter { it !in except }
            .toSet()

    /**
     * Turns a destroyed building into ruins and scorches the ground around it.
     * The landmark is replaced in the session so clients receive the new visual.
     */
    fun destroyBuilding(state: SessionState, game: GameState, landmarkId: UUID) {
        val landmark = state.landmarks[landmarkId] ?: return
        val coordinate = landmark.coordinate ?: return

        state.landmarks[landmarkId] = landmark.copy(type = LandmarkType.RUINS)
        (coordinate.neighbours() + coordinate).forEach { coord ->
            val tile = state.map.getTile(coord) ?: return@forEach
            state.map.setTile(coord, tile.copy(terrain = Terrain.SCORCHED))
        }
        game.towerOccupants.remove(landmarkId)
    }
}
