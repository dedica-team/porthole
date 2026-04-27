package team.dedica.porthole.domain

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class HexCoordinateTest {

    @Test
    fun `neighbours returns 6 adjacent coordinates`() {
        val center = HexCoordinate(0, 0)
        val neighbours = center.neighbours()
        assertEquals(6, neighbours.size)
    }

    @Test
    fun `distance between adjacent tiles is 1`() {
        val a = HexCoordinate(0, 0)
        val b = HexCoordinate(1, 0)
        assertEquals(1, a.distanceTo(b))
    }

    @Test
    fun `distance to self is 0`() {
        val a = HexCoordinate(3, -2)
        assertEquals(0, a.distanceTo(a))
    }

    @Test
    fun `distance across grid`() {
        val a = HexCoordinate(0, 0)
        val b = HexCoordinate(3, -3)
        assertEquals(3, a.distanceTo(b))
    }

    @Test
    fun `s coordinate satisfies cube constraint`() {
        val c = HexCoordinate(2, -1)
        assertEquals(0, c.q + c.r + c.s)
    }
}

