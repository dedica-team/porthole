package team.dedica.porthole.application.session.greenkeeping

import team.dedica.porthole.application.DataSanitationUtils
import team.dedica.porthole.domain.SessionState
import java.util.UUID

data class GreenkeepingRotationCollaboratorPatch(
    val id: UUID? = null,
    val collaboratorId: UUID,
)

internal fun normalizeGreenkeepingName(name: String): String {
    val trimmed = name.trim()
    require(trimmed.isNotBlank()) { "Greenkeeping rotation name must not be blank" }
    return trimmed
}

internal fun normalizeOptionalDescription(description: String?): String? =
    description?.trim()?.takeIf { it.isNotBlank() }

internal fun normalizeOptionalLink(link: String?): String? =
    link?.let(DataSanitationUtils::cleanLink)

internal fun SessionState.validateGreenkeepingGroups(groupIds: List<UUID>) {
    require(groupIds.isNotEmpty()) { "Greenkeeping rotation must contain at least one group" }
    require(groupIds.distinct().size == groupIds.size) { "Greenkeeping rotation must not contain duplicate groups" }
    groupIds.forEach { groupId ->
        require(groups.containsKey(groupId)) { "Group $groupId not found in session $id" }
    }
}

internal fun SessionState.validateGreenkeepingCollaborators(collaboratorIds: List<UUID>) {
    require(collaboratorIds.isNotEmpty()) { "Greenkeeping rotation must contain at least one collaborator" }
    require(collaboratorIds.distinct().size == collaboratorIds.size) {
        "Greenkeeping rotation must not contain duplicate collaborators"
    }
    collaboratorIds.forEach { collaboratorId ->
        require(isCollaborator(collaboratorId)) { "Collaborator $collaboratorId not found in session $id" }
    }
}

