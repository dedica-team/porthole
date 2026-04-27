package team.dedica.porthole.domain

import java.util.UUID

data class Process(
    val id: String = UUID.randomUUID().toString(),
    var name: String,
    var description: String? = null,
    val stages: MutableList<ProcessStage> = mutableListOf(),
)

