package team.dedica.porthole.domain

import java.util.UUID

enum class StageConnectionDirection { FORWARD, REVERSE, BIDIRECTIONAL }

data class StageConnection(
    val id: String = UUID.randomUUID().toString(),
    val connectionId: String,
    var title: String? = null,
    var direction: StageConnectionDirection = StageConnectionDirection.FORWARD,
)

