package team.dedica.porthole.domain

import java.util.UUID

data class Connection(
    val id: UUID = UUID.randomUUID(),
    val originId: UUID,
    val targetId: UUID,
    val path: List<HexCoordinate>,
    val type: ConnectionType = ConnectionType.PIPE,
    val name: String? = null,
    val description: String? = null,
)
