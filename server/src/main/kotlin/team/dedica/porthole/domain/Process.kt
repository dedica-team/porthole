package team.dedica.porthole.domain

import java.util.UUID

data class Process(
    val id: UUID = UUID.randomUUID(),
    var name: String,
    var description: String? = null,
    val stages: MutableList<ProcessStage> = mutableListOf(),
)
