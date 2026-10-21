package team.dedica.porthole.domain

import java.util.UUID

data class GreenkeepingTaskTemplateItem(
    val id: UUID = UUID.randomUUID(),
    var title: String,
)
