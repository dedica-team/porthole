package team.dedica.porthole.domain

import java.time.Instant
import java.util.UUID

data class GreenkeepingChecklistItem(
    val id: UUID = UUID.randomUUID(),
    var title: String,
    var done: Boolean = false,
    var note: String? = null,
)

data class GreenkeepingChecklist(
    val id: UUID = UUID.randomUUID(),
    var title: String,
    val createdAt: Instant = Instant.now(),
    val createdBy: UUID? = null,
    var finishedAt: Instant? = null,
    var finishedBy: UUID? = null,
    val items: MutableList<GreenkeepingChecklistItem> = mutableListOf(),
)
