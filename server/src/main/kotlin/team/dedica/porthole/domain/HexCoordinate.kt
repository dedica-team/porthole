package team.dedica.porthole.domain

/**
 * Axial hex coordinates (q = column, r = row).
 * Cube coordinate: s = -q - r (implicitly).
 */
data class HexCoordinate(val q: Int, val r: Int) {

    val s: Int get() = -q - r

    /** Returns all 6 direct neighbours. */
    fun neighbours(): List<HexCoordinate> = DIRECTIONS.map { (dq, dr) ->
        HexCoordinate(q + dq, r + dr)
    }

    fun distanceTo(other: HexCoordinate): Int =
        (kotlin.math.abs(q - other.q) +
         kotlin.math.abs(r - other.r) +
         kotlin.math.abs(s - other.s)) / 2

    companion object {
        private val DIRECTIONS = listOf(
            Pair(1, 0), Pair(1, -1), Pair(0, -1),
            Pair(-1, 0), Pair(-1, 1), Pair(0, 1)
        )
    }
}

