package team.dedica.porthole.adapter.`in`.web.dto

import com.fasterxml.jackson.databind.annotation.JsonSerialize
import com.fasterxml.jackson.databind.ser.std.UUIDSerializer
import io.micronaut.core.annotation.Introspected
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import team.dedica.porthole.domain.ChoreEntryState
import java.util.*

/** Sent by the client when creating a new mapping session. */
@Introspected
data class CreateMapRequest(
    /** "LAND" (default), "SEA", or "BLANK" */
    val mapType: String = "LAND",
    /** "SMALL" (25×25), "MEDIUM" (50×50, default), or "LARGE" (80×80) */
    val mapSize: String = "MEDIUM",
)

private const val NAME_MAX_LENGTH = 200
private const val DESCRIPTION_MAX_LENGTH = 2000
private const val LINK_MAX_LENGTH = 2000

@Introspected
data class PlaceLandmarkRequest(
    val q: Int,
    val r: Int,
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    val type: String = "KEEP",
)

@Introspected
data class EditLandmarkRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String?,
    val type: String?,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    val groupId: String? = null,
    val clearGroup: Boolean = false,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val link: String? = null,
    val clearLink: Boolean = false,
    val ownerId: String? = null,
    val clearOwner: Boolean = false,
)

@Introspected
data class CreateConnectionRequest(
    val fromTowerId: String,
    val toTowerId: String,
    val type: String = "PIPE",
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
)

@Introspected
data class EditConnectionRequest(
    val type: String? = null,
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    val clearName: Boolean = false,
    val clearDescription: Boolean = false,
)

@Introspected
data class EditTileRequest(val elevation: Int?, val terrain: String?)

@Introspected
data class CreateGroupRequest(
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    val color: String,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
)

@Introspected
data class EditGroupRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String?,
    val color: String?,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    val clearDescription: Boolean = false,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
    val clearLink: Boolean = false,
)

@Introspected
data class EditMapRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String?,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String?,
)

@Introspected
data class CreateMetricRequest(
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
)
@Introspected
data class EditMetricRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String?,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String?,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
    val clearLink: Boolean = false,
)
@Introspected
data class SetLandmarkMetricRequest(
    @field:Size(max = 500) val value: String? = null,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
    @field:Size(max = NAME_MAX_LENGTH) val linkText: String? = null,
    val level: String,   // "NONE" | "OK" | "WARNING" | "ERROR"
    val badges: Map<@Size(max = 100) String, @Size(max = DESCRIPTION_MAX_LENGTH) String> = emptyMap(),
)
@Introspected
data class SetCollaborationModeRequest(val mode: String) // "OPEN" | "REQUEST" | "PRIVATE"

@Introspected
data class CreateUnpositionedLandmarkRequest(
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    val type: String = "KEEP",
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    val groupId: String? = null,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
)

@Introspected
data class PositionLandmarkRequest(
    val q: Int,
    val r: Int,
)

@Introspected
data class EditCollaboratorMatrixRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    val collaborators: List<UUID>? = null,
)

@Introspected
data class SetMatrixEntryRequest(
    val level: String, // "NONE" | "LOW" | "MEDIUM" | "HIGH"
)

// ── Processes ────────────────────────────────────────────────────────────────

@Introspected
data class CreateProcessRequest(
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
)

@Introspected
data class EditProcessRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
)

@Introspected
data class CreateProcessStageRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    val order: Int,
)

@Introspected
data class AddStageConnectionRequest(
    val connectionId: String,
    val title: String? = null,
    val direction: String = "FORWARD",
)

@Introspected
data class EditStageConnectionRequest(
    val title: String? = null,
    val clearTitle: Boolean = false,
    val direction: String? = null,
)

@Introspected
data class EditProcessStageRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    val clearName: Boolean = false,
    val order: Int? = null,
)

@Introspected
data class ReorderProcessStagesRequest(
    val stageIds: List<String>,
)

// ── Chore Lists ───────────────────────────────────────────────────────────────

@Introspected
data class CreateChoreListRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    val landmarkIds: List<String> = emptyList(),
    @field:Size(max = 2000) val link: String? = null,
    @field:Size(max = 2000) val description: String? = null,
)

@Introspected
data class EditChoreListRequest(
    @field:Size(max = 200) val title: String? = null,
    val landmarkIds: List<String>? = null,
    @field:Size(max = 2000) val link: String? = null,
    val clearLink: Boolean = false,
    @field:Size(max = 2000) val description: String? = null,
    val clearDescription: Boolean = false,
)

@Introspected
data class UpdateChoreEntryRequest(
    val state: ChoreEntryState? = null,
    @param:JsonSerialize(using = UUIDSerializer::class)
    val assigneeId: UUID? = null,
    val clearAssignee: Boolean = false,
    val link: String? = null,
    val clearLink: Boolean = false,
    val note: String? = null,
    val clearNote: Boolean = false,
)

// ── Greenkeeping Rotations ───────────────────────────────────────────────────

@Introspected
data class GreenkeepingRotationCollaboratorRequest(
    @param:JsonSerialize(using = UUIDSerializer::class)
    val id: UUID? = null,
    @param:JsonSerialize(using = UUIDSerializer::class)
    val collaboratorId: UUID,
    val done: Boolean = false,
)

@Introspected
data class GreenkeepingTaskTemplateItemRequest(
    @param:JsonSerialize(using = UUIDSerializer::class)
    val id: UUID? = null,
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val title: String,
)

@Introspected
data class CreateGreenkeepingRotationRequest(
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val name: String,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
    val groupIds: List<String> = emptyList(),
    val collaborators: List<GreenkeepingRotationCollaboratorRequest> = emptyList(),
    val taskTemplates: List<GreenkeepingTaskTemplateItemRequest> = emptyList(),
)

@Introspected
data class EditGreenkeepingRotationRequest(
    @field:Size(max = NAME_MAX_LENGTH) val name: String? = null,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val description: String? = null,
    val clearDescription: Boolean = false,
    @field:Size(max = LINK_MAX_LENGTH) val link: String? = null,
    val clearLink: Boolean = false,
    val groupIds: List<String>? = null,
    val collaborators: List<GreenkeepingRotationCollaboratorRequest>? = null,
    val taskTemplates: List<GreenkeepingTaskTemplateItemRequest>? = null,
)

@Introspected
data class GreenkeepingChecklistItemRequest(
    @param:JsonSerialize(using = UUIDSerializer::class)
    val id: UUID? = null,
    @field:NotBlank @field:Size(max = NAME_MAX_LENGTH) val title: String,
    val done: Boolean = false,
    @field:Size(max = DESCRIPTION_MAX_LENGTH) val note: String? = null,
)

@Introspected
data class StartGreenkeepingChecklistRequest(
    @field:Size(max = NAME_MAX_LENGTH) val title: String? = null,
)

@Introspected
data class UpdateGreenkeepingChecklistRequest(
    @field:Size(max = NAME_MAX_LENGTH) val title: String? = null,
    val items: List<GreenkeepingChecklistItemRequest>? = null,
)



