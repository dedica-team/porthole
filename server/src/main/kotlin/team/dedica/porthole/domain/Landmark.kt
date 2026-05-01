package team.dedica.porthole.domain

import java.util.*

/**
 * A landmark placed on a hex tile.
 *
 * @param id          unique landmark UUID
 * @param name        human-readable display name (e.g. "Iron Keep")
 * @param ownerId     user ID who placed this landmark, or null if unowned
 * @param coordinate  position on the hex grid, or null for unpositioned landmarks
 * @param type        visual type of the landmark structure
 * @param description optional free-text description
 * @param groupId     optional reference to a [LandmarkGroup] id
 * @param link        optional URL associated with this landmark (must be a valid http/https URL)
 */
data class Landmark(
    val id: UUID,
    val name: String = id.toString(),
    val ownerId: UUID? = null,
    val coordinate: HexCoordinate? = null,
    val type: LandmarkType = LandmarkType.KEEP,
    val description: String? = null,
    val groupId: UUID? = null,
    val link: String? = null,
    val metrics: Map<UUID, LandmarkMetricEntry> = emptyMap(),
)
