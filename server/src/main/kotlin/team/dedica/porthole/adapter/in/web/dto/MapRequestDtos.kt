package team.dedica.porthole.adapter.`in`.web.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class ChangeLandmarkOwnerRequest(
    val ownerId: String?,  // null or blank → unset owner
)

/** Sent by the client when creating a new mapping session. */
data class CreateMapRequest(
    /** "LAND" (default), "SEA", or "BLANK" */
    val mapType: String = "LAND",
    /** "SMALL" (25×25), "MEDIUM" (50×50, default), or "LARGE" (80×80) */
    val mapSize: String = "MEDIUM",
)

private const val NAME_MAX_LENGTH = 200
private const val DESCRIPTION_MAX_LENGTH = 2000
private const val LINK_MAX_LENGTH = 2000

data class PlaceLandmarkRequest(
    val q: Int,
    val r: Int,
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    val type: String = "KEEP",
)

data class EditLandmarkRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String?,
    val type: String?,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    val groupId: String? = null,
    val clearGroup: Boolean = false,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val link: String? = null,
    val clearLink: Boolean = false,
)

data class CreateConnectionRequest(
    val fromTowerId: String,
    val toTowerId: String,
    val type: String = "PIPE",
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
)

data class EditConnectionRequest(
    val type: String? = null,
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    val clearName: Boolean = false,
    val clearDescription: Boolean = false,
)

data class EditTileRequest(val elevation: Int?, val terrain: String?)

data class CreateGroupRequest(
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    val color: String,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
)

data class EditGroupRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String?,
    val color: String?,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    val clearDescription: Boolean = false,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
    val clearLink: Boolean = false,
)

data class EditMapRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String?,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String?,
)

data class CreateMetricRequest(
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String,
)
data class EditMetricRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String?,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String?,
)
data class SetLandmarkMetricRequest(
    @field:Size(max = 500) val value: String? = null,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
    val level: String,   // "NONE" | "OK" | "WARNING" | "ERROR"
    val badges: Map<@Size(max = 100) String, @Size(max = DESCRIPTION_MAX_LENGTH) String> = emptyMap(),
)
data class SetCollaborationModeRequest(val mode: String) // "OPEN" | "REQUEST" | "PRIVATE"

data class CreateUnpositionedLandmarkRequest(
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    val type: String = "KEEP",
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    val groupId: String? = null,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
)

data class PositionLandmarkRequest(
    val q: Int,
    val r: Int,
)

data class EditCollaboratorMatrixRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String?,
)

data class SetMatrixEntryRequest(
    val level: String, // "NONE" | "LOW" | "MEDIUM" | "HIGH"
)

// ── Processes ────────────────────────────────────────────────────────────────

data class CreateProcessRequest(
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
)

data class EditProcessRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
)

data class CreateProcessStageRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    val order: Int,
)

data class AddStageConnectionRequest(
    val connectionId: String,
    val title: String? = null,
    val direction: String = "FORWARD",
)

data class EditStageConnectionRequest(
    val title: String? = null,
    val clearTitle: Boolean = false,
    val direction: String? = null,
)

data class EditProcessStageRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    val clearName: Boolean = false,
    val order: Int? = null,
)

data class ReorderProcessStagesRequest(
    val stageIds: List<String>,
)



