package team.dedica.porthole.domain

/**
 * A named, coloured group that landmarks can belong to.
 *
 * @param id    UUID generated at creation time
 * @param name  human-readable label (e.g. "Northern Faction")
 * @param color CSS hex colour string (e.g. "#e74c3c")
 */
data class LandmarkGroup(
    val id: String,
    val name: String,
    val color: String,
    val description: String? = null,
    val link: String? = null,
)

