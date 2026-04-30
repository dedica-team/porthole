package team.dedica.porthole.adapter.out.messaging

import team.dedica.porthole.domain.*
import java.time.Instant

/**
 * The payload sent to WebSocket subscribers.
 * Processes are intentionally excluded – they are served via the dedicated
 * REST endpoint and must be fetched on demand.
 */
data class MapStateBroadcastDto(
    val id: String,
    val map: HexMap,
    val collaborators: List<Collaborator>,
    val landmarks: Map<String, Landmark>,
    val connections: Map<String, Connection>,
    val groups: Map<String, LandmarkGroup>,
    val metrics: Map<String, QualityMetric>,
    val createdAt: Instant,
    val name: String?,
    val description: String?,
    val collaborationMode: CollaborationMode,
    val joinRequests: List<JoinRequest>,
    val collaboratorMatrix: CollaboratorMatrix,
    val choreLists: Map<String, ChoreList>,
) {
    companion object {
        fun from(state: MapState) = MapStateBroadcastDto(
            id = state.id,
            map = state.map,
            collaborators = state.collaborators,
            landmarks = state.landmarks,
            connections = state.connections,
            groups = state.groups,
            metrics = state.metrics,
            createdAt = state.createdAt,
            name = state.name,
            description = state.description,
            collaborationMode = state.collaborationMode,
            joinRequests = state.joinRequests,
            collaboratorMatrix = state.collaboratorMatrix,
            choreLists = state.choreLists,
        )
    }
}

