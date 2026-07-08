package team.dedica.porthole.domain

import java.util.UUID

data class ChoreList(
    val id: UUID = UUID.randomUUID(),
    var title: String,
    var completed: Boolean = false,
    var link: String? = null,
    var description: String? = null,
    val entries: MutableMap<UUID, ChoreEntry> = mutableMapOf(), // keyed by landmarkId
)
