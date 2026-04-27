package team.dedica.porthole.domain

data class Connection(
    val id: String,
    val originId: String,
    val targetId: String,
    val path: List<HexCoordinate>,
    val type: ConnectionType = ConnectionType.PIPE,
    val name: String? = null,
    val description: String? = null,
)

