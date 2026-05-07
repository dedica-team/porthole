package team.dedica.porthole.domain

import java.util.UUID

data class GreenkeepingRotationCollaborator(
    val id: UUID = UUID.randomUUID(),
    var collaboratorId: UUID,
    var done: Boolean = false,
)

