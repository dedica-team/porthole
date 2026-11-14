package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.math.sqrt

class GameGeometryTest {

    @Test
    fun `Vec3 normalized returns normalized unit vector or null if zero length`() {
        val v = Vec3(3.0, 4.0, 0.0)
        val norm = v.normalized()
        assertNotNull(norm)
        assertEquals(0.6, norm!!.x, 1e-6)
        assertEquals(0.8, norm.y, 1e-6)
        assertEquals(0.0, norm.z, 1e-6)
        assertEquals(1.0, norm.length(), 1e-6)

        assertNull(Vec3(0.0, 0.0, 0.0).normalized())
        assertNull(Vec3(Double.NaN, 0.0, 0.0).normalized())
    }

    @Test
    fun `Vec3 dot, minus, length, and isFinite`() {
        val a = Vec3(1.0, 2.0, 3.0)
        val b = Vec3(4.0, -5.0, 6.0)
        assertEquals(12.0, a.dot(b), 1e-6)
        assertEquals(Vec3(-3.0, 7.0, -3.0), a - b)
        assertEquals(sqrt(14.0), a.length(), 1e-6)
        assertTrue(a.isFinite())
        assertFalse(Vec3(Double.POSITIVE_INFINITY, 0.0, 0.0).isFinite())
    }

    @Test
    fun `isValidDirection validates vector finiteness and magnitude`() {
        assertTrue(GameGeometry.isValidDirection(Vec3(1.0, 0.0, 0.0)))
        assertFalse(GameGeometry.isValidDirection(Vec3(0.0, 0.0, 0.0)))
        assertFalse(GameGeometry.isValidDirection(Vec3(Double.NaN, 1.0, 0.0)))
    }

    @Test
    fun `raySphereDistance returns correct distance when ray hits sphere from outside`() {
        val origin = Vec3(0.0, 0.0, 0.0)
        val dir = Vec3(1.0, 0.0, 0.0)
        val center = Vec3(5.0, 0.0, 0.0)
        val radius = 1.0

        val distance = GameGeometry.raySphereDistance(origin, dir, center, radius)
        assertNotNull(distance)
        assertEquals(4.0, distance!!, 1e-6)
    }

    @Test
    fun `raySphereDistance returns exit distance when origin is inside sphere`() {
        val origin = Vec3(5.0, 0.0, 0.0)
        val dir = Vec3(1.0, 0.0, 0.0)
        val center = Vec3(5.0, 0.0, 0.0)
        val radius = 2.0

        val distance = GameGeometry.raySphereDistance(origin, dir, center, radius)
        assertNotNull(distance)
        assertEquals(2.0, distance!!, 1e-6)
    }

    @Test
    fun `raySphereDistance returns null when ray misses sphere`() {
        val origin = Vec3(0.0, 0.0, 0.0)
        val dir = Vec3(1.0, 0.0, 0.0)
        val center = Vec3(5.0, 2.0, 0.0)
        val radius = 1.0

        val distance = GameGeometry.raySphereDistance(origin, dir, center, radius)
        assertNull(distance)
    }

    @Test
    fun `raySphereDistance returns null when sphere is behind the ray`() {
        val origin = Vec3(0.0, 0.0, 0.0)
        val dir = Vec3(-1.0, 0.0, 0.0)
        val center = Vec3(5.0, 0.0, 0.0)
        val radius = 1.0

        val distance = GameGeometry.raySphereDistance(origin, dir, center, radius)
        assertNull(distance)
    }

    @Test
    fun `findHitTarget hits bug and calculates exact hitPoint`() {
        val state = SessionState(map = HexMap.createHexagonal(3, elevationFn = { 1 }), gameEnabled = true)
        val bug = Bug(coordinate = HexCoordinate(1, 0))
        val gameState = GameState(phase = GamePhase.ACTIVE, bugs = mutableMapOf(bug.id to bug))

        val origin = Vec3(0.0, 0.45 + GameGeometry.TOWER_EYE_HEIGHT, 0.0)
        val bugPos = GameGeometry.bugPosition(state, bug)
        val dir = (bugPos - origin).normalized()!!

        val hit = GameGeometry.findHitTarget(state, gameState, origin, dir)
        assertNotNull(hit)
        assertEquals(bug, hit!!.bug)
        assertNotNull(hit.hitPoint)
        assertTrue(hit.distance > 0)
    }

    @Test
    fun `findHitTarget ignores shooter's own watchtower`() {
        val state = SessionState(map = HexMap.createHexagonal(3, elevationFn = { 1 }), gameEnabled = true)
        val tower = Landmark(
            id = UUID.randomUUID(),
            name = "My Tower",
            coordinate = HexCoordinate(0, 0),
            type = LandmarkType.WATCHTOWER,
        )
        state.landmarks[tower.id] = tower
        val gameState = GameState(phase = GamePhase.ACTIVE)

        val origin = Vec3(0.0, 0.45 + GameGeometry.TOWER_EYE_HEIGHT, 0.0)
        val dir = Vec3(0.0, -1.0, 0.0)

        val hit = GameGeometry.findHitTarget(state, gameState, origin, dir, shooterTowerId = tower.id)
        assertNull(hit)
    }
}
