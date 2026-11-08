package team.dedica.porthole.domain

import java.util.UUID
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.sqrt

data class Vec3(val x: Double, val y: Double, val z: Double) {

    fun normalized(): Vec3? {
        val length = sqrt(x * x + y * y + z * z)
        if (length <= 1e-9 || !length.isFinite()) return null
        return Vec3(x / length, y / length, z / length)
    }

    fun dot(other: Vec3): Double = x * other.x + y * other.y + z * other.z

    operator fun minus(other: Vec3): Vec3 = Vec3(x - other.x, y - other.y, z - other.z)

    fun length(): Double = sqrt(x * x + y * y + z * z)

    fun isFinite(): Boolean = x.isFinite() && y.isFinite() && z.isFinite()
}

data class HitTarget(
    val distance: Double,
    val bug: Bug? = null,
    val landmark: Landmark? = null,
    val hitPoint: Vec3? = null,
)

/**
 * World-space geometry shared by the server-side hit resolution and the client renderer.
 * Kept in sync with `client/src/utils/hexUtils.ts` and `terrainUtils.tileHeight`.
 */
object GameGeometry {
    const val BUG_RADIUS = 0.35
    const val BUG_HEIGHT = 0.35
    const val BUILDING_RADIUS = 0.8
    const val BUILDING_HEIGHT = 0.8
    const val MAX_RANGE = 150.0

    fun hexToWorld(coordinate: HexCoordinate, size: Double = 1.0): Pair<Double, Double> {
        val x = size * 1.5 * coordinate.q
        val z = size * (sqrt(3.0) / 2.0 * coordinate.q + sqrt(3.0) * coordinate.r)
        return x to z
    }

    fun tileHeight(elevation: Int): Double = 0.2 + elevation * 0.25

    fun bugPosition(state: SessionState, bug: Bug): Vec3 =
        tilePositions(state, bug.coordinate)

    fun buildingPosition(state: SessionState, landmark: Landmark): Vec3? {
        val coordinate = landmark.coordinate ?: return null
        val (x, z) = hexToWorld(coordinate)
        val elevation = state.map.getTile(coordinate)?.elevation ?: 0
        return Vec3(x, tileHeight(elevation) + BUILDING_HEIGHT * 0.5, z)
    }

    private fun tilePositions(state: SessionState, coordinate: HexCoordinate): Vec3 {
        val (x, z) = hexToWorld(coordinate)
        val elevation = state.map.getTile(coordinate)?.elevation ?: 0
        return Vec3(x, tileHeight(elevation) + BUG_HEIGHT, z)
    }

    /**
     * Centers the hit sphere at several points along the bug's latest step.
     * The client animates bugs continuously, so a shot aimed at the visible bug
     * must also match while it is between its previous and current tile.
     */
    private fun bugHitCenters(state: SessionState, bug: Bug): List<Vec3> {
        val current = bugPosition(state, bug)
        val previousCoordinate = bug.previousCoordinate ?: return listOf(current)
        if (previousCoordinate == bug.coordinate) return listOf(current)
        val previous = tilePositions(state, previousCoordinate)

        val distance = current.minus(previous).length()
        val steps = max(1, ceil(distance / (BUG_RADIUS * 0.6)).toInt())
        return (0..steps).map { index ->
            val t = index.toDouble() / steps
            Vec3(
                previous.x + (current.x - previous.x) * t,
                previous.y + (current.y - previous.y) * t,
                previous.z + (current.z - previous.z) * t,
            )
        }
    }

    /** Camera origin used by the client while manning [landmark]; kept in sync with the renderer. */
    fun towerEyePosition(state: SessionState, landmark: Landmark): Vec3? {
        val coordinate = landmark.coordinate ?: return null
        val (x, z) = hexToWorld(coordinate)
        val elevation = state.map.getTile(coordinate)?.elevation ?: 0
        return Vec3(x, tileHeight(elevation) + 1.45, z)
    }

    /** Returns the ray parameter of the first bug hit, or null. */
    fun findHit(
        state: SessionState,
        game: GameState,
        origin: Vec3,
        direction: Vec3,
    ): Bug? = findHitTarget(state, game, origin, direction)?.bug

    /**
     * Casts a ray into the scene and finds the closest target hit (bug or attackable building).
     */
    fun findHitTarget(
        state: SessionState,
        game: GameState,
        origin: Vec3,
        direction: Vec3,
        shooterTowerId: UUID? = null,
    ): HitTarget? {
        val dir = direction.normalized() ?: return null
        if (!origin.isFinite()) return null

        val bugHits = game.bugs.values
            .asSequence()
            .mapNotNull { bug ->
                val t = bugHitCenters(state, bug)
                    .mapNotNull { raySphereDistance(origin, dir, it, BUG_RADIUS) }
                    .minOrNull()
                    ?: return@mapNotNull null
                if (t > MAX_RANGE) null else HitTarget(distance = t, bug = bug)
            }

        val buildingHits = state.landmarks.values
            .asSequence()
            .filter { landmark ->
                landmark.id != shooterTowerId &&
                    GameEngine.isAttackable(landmark, state.map) &&
                    (game.buildingHealth[landmark.id] ?: game.buildingMaxHealth) > 0
            }
            .mapNotNull { landmark ->
                val center = buildingPosition(state, landmark) ?: return@mapNotNull null
                val t = raySphereDistance(origin, dir, center, BUILDING_RADIUS) ?: return@mapNotNull null
                if (t > MAX_RANGE) null else HitTarget(distance = t, landmark = landmark)
            }

        val closest = (bugHits + buildingHits).minByOrNull { it.distance } ?: return null
        val hitPoint = Vec3(
            origin.x + dir.x * closest.distance,
            origin.y + dir.y * closest.distance,
            origin.z + dir.z * closest.distance,
        )
        return closest.copy(hitPoint = hitPoint)
    }

    /** Distance along the ray to the sphere surface, or null when there is no hit. */
    fun raySphereDistance(origin: Vec3, direction: Vec3, center: Vec3, radius: Double): Double? {
        val oc = center - origin
        val tca = oc.dot(direction)
        if (tca < 0) return null

        val d2 = oc.dot(oc) - tca * tca
        val r2 = radius * radius
        if (d2 > r2) return null

        val thc = sqrt(r2 - d2)
        val t0 = tca - thc
        val t1 = tca + thc
        return when {
            t0 >= 0 -> t0
            t1 >= 0 -> t1
            else -> null
        }
    }

    fun isValidDirection(direction: Vec3): Boolean =
        direction.isFinite() && abs(direction.x) + abs(direction.y) + abs(direction.z) > 1e-9
}
