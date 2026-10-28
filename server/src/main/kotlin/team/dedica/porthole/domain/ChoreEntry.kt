package team.dedica.porthole.domain

import java.util.UUID

data class ChoreEntry(
    val landmarkId: UUID,
    var state: ChoreEntryState = ChoreEntryState.NONE,
    var assigneeId: UUID? = null,
    var link: String? = null,
    var note: String? = null,
)
