package team.dedica.porthole.domain

import com.fasterxml.jackson.databind.annotation.JsonSerialize
import com.fasterxml.jackson.databind.ser.std.UUIDSerializer
import java.util.UUID

/**
 * A named, coloured group that landmarks can belong to.
 *
 * @param id    UUID generated at creation time
 * @param name  human-readable label (e.g. "Northern Faction")
 * @param color CSS hex colour string (e.g. "#e74c3c")
 */
data class LandmarkGroup(
    @param:JsonSerialize(using = UUIDSerializer::class)
    val id: UUID,
    val name: String,
    val color: String,
    val description: String? = null,
    val link: String? = null,
)

