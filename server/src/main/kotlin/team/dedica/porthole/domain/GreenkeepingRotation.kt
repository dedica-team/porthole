package team.dedica.porthole.domain

import java.time.Instant
import java.util.UUID

data class GreenkeepingRotation(
    val id: UUID = UUID.randomUUID(),
    var name: String,
    var description: String? = null,
    var link: String? = null,
    val groupIds: MutableList<UUID> = mutableListOf(),
    val collaborators: MutableList<GreenkeepingRotationCollaborator> = mutableListOf(),
    val taskTemplates: MutableList<GreenkeepingTaskTemplateItem> = mutableListOf(),
    var currentChecklist: GreenkeepingChecklist? = null,
    val completedChecklists: MutableList<GreenkeepingChecklist> = mutableListOf(),
    var updatedAt: Instant = Instant.now(),
    var updatedBy: UUID? = null,
)

