package team.dedica.porthole.domain

import java.util.UUID

data class ProcessStage(
    val id: UUID = UUID.randomUUID(),
    var name: String? = null,
    var order: Int,
    val connections: MutableList<StageConnection> = mutableListOf(),
)
