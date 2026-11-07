package team.dedica.porthole.adapter.out.messaging
import team.dedica.porthole.domain.*
import java.time.Instant
import java.util.UUID
/**
 * The payload sent to WebSocket subscribers on /topic/map/{id}.
 * Metrics, chore lists, greenkeeping rotations, and the collaborator matrix are broadcast on
 * dedicated sub-topics (/metrics, /chore-lists, /greenkeeping-rotations, /matrix) so that
 * subscribers can selectively consume only what they need.
 */
data class MapStateBroadcastDto(
    val id: String,
    val map: HexMap,
    val collaborators: List<Collaborator>,
    val landmarks: Map<UUID, Landmark>,
    val connections: Map<UUID, Connection>,
    val groups: Map<UUID, LandmarkGroup>,
    val createdAt: Instant,
    val name: String?,
    val description: String?,
    val collaborationMode: CollaborationMode,
    val joinRequests: List<JoinRequest>,
    val gameEnabled: Boolean,
) {
    companion object {
        fun from(state: SessionState) = MapStateBroadcastDto(
            id = state.id.toString(),
            map = state.map,
            collaborators = state.collaborators.toList(),
            landmarks = state.landmarks.toMap(),
            connections = state.connections.toMap(),
            groups = state.groups.toMap(),
            createdAt = state.createdAt,
            name = state.name,
            description = state.description,
            collaborationMode = state.collaborationMode,
            joinRequests = state.joinRequests.toList(),
            gameEnabled = state.gameEnabled,
        )
    }
}
