package team.dedica.porthole.domain

data class ChoreEntry(
    val landmarkId: String,
    var state: ChoreEntryState = ChoreEntryState.NONE,
    var assigneeId: String? = null,
    var link: String? = null,
    var note: String? = null,
)

