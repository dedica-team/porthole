package team.dedica.porthole.domain

/**
 * A single hex tile on the game map.
 *
 * @param coordinate  axial position on the grid
 * @param elevation   height value (0–5)
 * @param terrain     surface type; independent of elevation
 */
data class HexTile(
    val coordinate: HexCoordinate,
    val elevation: Int = 0,
    val terrain: Terrain = Terrain.GRASS,
) {
    init {
        require(elevation in 0..5) { "Elevation must be between 0 and 5" }
    }
}
