package team.dedica.porthole.domain

import java.util.UUID

data class ChoreList(
    val id: String = UUID.randomUUID().toString(),
    var title: String,
    var completed: Boolean = false,
    var link: String? = null,
    val entries: MutableMap<String, ChoreEntry> = mutableMapOf(), // keyed by landmarkId
)

