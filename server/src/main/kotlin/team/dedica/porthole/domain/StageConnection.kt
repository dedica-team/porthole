package team.dedica.porthole.domain

import java.util.UUID

enum class StageConnectionDirection { FORWARD, REVERSE, BIDIRECTIONAL }

data class StageConnection(
    val id: UUID = UUID.randomUUID(),
    val connectionId: UUID,
    var title: String? = null,
    var direction: StageConnectionDirection = StageConnectionDirection.FORWARD,
)
