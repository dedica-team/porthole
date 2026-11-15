package team.dedica.porthole.domain

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonProperty
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
 * @param links       map of named links associated with this landmark (e.g. "repository" -> "https://...", "docs" -> "https://...")
 * @param metrics     assigned quality metric values keyed by metric UUID
 * @param aliases     alternative names or identifiers for this element
 */
data class Landmark(
    val id: UUID,
    val name: String = id.toString(),
    val ownerId: UUID? = null,
    val coordinate: HexCoordinate? = null,
    val type: LandmarkType = LandmarkType.KEEP,
    val description: String? = null,
    val groupId: UUID? = null,
    val links: Map<String, String> = emptyMap(),
    val metrics: Map<UUID, LandmarkMetricEntry> = emptyMap(),
    val aliases: List<String> = emptyList(),
) {
    companion object {
        @JvmStatic
        @JsonCreator
        fun fromJson(
            @JsonProperty("id") id: UUID,
            @JsonProperty("name") name: String? = null,
            @JsonProperty("ownerId") ownerId: UUID? = null,
            @JsonProperty("coordinate") coordinate: HexCoordinate? = null,
            @JsonProperty("type") type: LandmarkType? = null,
            @JsonProperty("description") description: String? = null,
            @JsonProperty("groupId") groupId: UUID? = null,
            @JsonProperty("links") links: Map<String, String>? = null,
            @JsonProperty("link") legacyLink: String? = null,
            @JsonProperty("metrics") metrics: Map<UUID, LandmarkMetricEntry>? = null,
            @JsonProperty("aliases") aliases: List<String>? = null,
        ): Landmark {
            val resolvedLinks = when {
                !links.isNullOrEmpty() -> links
                !legacyLink.isNullOrBlank() -> mapOf("default" to legacyLink)
                else -> emptyMap()
            }
            return Landmark(
                id = id,
                name = name ?: id.toString(),
                ownerId = ownerId,
                coordinate = coordinate,
                type = type ?: LandmarkType.KEEP,
                description = description,
                groupId = groupId,
                links = resolvedLinks,
                metrics = metrics ?: emptyMap(),
                aliases = aliases?.map { it.trim() }?.filter { it.isNotBlank() }?.distinct() ?: emptyList(),
            )
        }
    }
}
