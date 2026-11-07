package team.dedica.porthole.domain

import java.time.Instant
import java.util.UUID

/** Enemy NPC that emerges from a red-status tile and attacks the landscape. */
enum class BugType {
    CRAWLER,
}

/**
 * A single bug on the map.
 *
 * @param coordinate         current axial tile position
 * @param previousCoordinate tile the bug came from on its latest step; used to make
 *                           shots along the traversed path count while the client
 *                           interpolates the visual movement
 * @param spawnCoordinate    tile the bug emerged from (used for respawn / debugging)
 * @param hp                 remaining hit points; a successful shot removes the bug
 * @param targetLandmarkId   building the bug is currently marching towards
 */
data class Bug(
    val id: UUID = UUID.randomUUID(),
    val coordinate: HexCoordinate,
    val previousCoordinate: HexCoordinate? = null,
    val spawnCoordinate: HexCoordinate = coordinate,
    val hp: Int = 1,
    val type: BugType = BugType.CRAWLER,
    val targetLandmarkId: UUID? = null,
    val spawnedAt: Instant = Instant.now(),
)
