package team.dedica.porthole.domain

/**
 * A landmark placed on a hex tile.
 *
 * @param id          unique landmark ID (slug derived from name, e.g. "iron-keep")
 * @param name        human-readable display name (e.g. "Iron Keep")
 * @param ownerId     user ID who placed this landmark, or null if unowned
 * @param coordinate  position on the hex grid, or null for unpositioned landmarks
 * @param type        visual type of the landmark structure
 * @param description optional free-text description
 * @param groupId     optional reference to a [LandmarkGroup] id
 * @param link        optional URL associated with this landmark (must be a valid http/https URL)
 */
data class Landmark(
    val id: String,
    val name: String = id,
    val ownerId: String? = null,
    val coordinate: HexCoordinate? = null,
    val type: LandmarkType = LandmarkType.KEEP,
    val description: String? = null,
    val groupId: String? = null,
    val link: String? = null,
    /** Quality metric entries keyed by [LandmarkMetricEntry.metricId]. */
    val metrics: Map<String, LandmarkMetricEntry> = emptyMap(),
)
