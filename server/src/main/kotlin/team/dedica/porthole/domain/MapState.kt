package team.dedica.porthole.domain

import java.time.Instant
import java.util.*

/**
 * The complete state of a landscape design session.
 *
 * @param id      unique session ID
 * @param map     the hex grid
 * @param collaborators all collaborators participating in this session (by collaborator ID)
 * @param landmarks  all placed landmarks (by landmark ID)
 */
data class MapState(
    val id: String = UUID.randomUUID().toString(),
    val map: HexMap,
    val collaborators: MutableList<Collaborator> = mutableListOf(),
    val landmarks: MutableMap<String, Landmark> = mutableMapOf(),
    val connections: MutableMap<String, Connection> = mutableMapOf(),
    val groups: MutableMap<String, LandmarkGroup> = mutableMapOf(),
    val metrics: MutableMap<String, QualityMetric> = mutableMapOf(),
    val createdAt: Instant = Instant.now(),
    val name: String? = null,
    val description: String? = null,
    val collaborationMode: CollaborationMode = CollaborationMode.OPEN,
    val joinRequests: MutableList<JoinRequest> = mutableListOf(),
    var collaboratorMatrix: CollaboratorMatrix = CollaboratorMatrix(),
    val processes: MutableMap<String, Process> = mutableMapOf(),
) {

    fun getCollaborator(collaboratorId: String): Collaborator? = collaborators.find { it.id == collaboratorId }

    fun getLandmarksOf(collaboratorId: String): List<Landmark> =
        landmarks.values.filter { it.ownerId == collaboratorId }

    fun getLandmarkAt(coordinate: HexCoordinate): Landmark? =
        landmarks.values.find { it.coordinate != null && it.coordinate == coordinate }

    fun isCollaborator(userId: String): Boolean = collaborators.any { it.id == userId }

    fun hasPendingRequest(userId: String): Boolean = joinRequests.any { it.userId == userId }

    fun requireCollaborator(userId: String) {
        require(isCollaborator(userId)) { "User $userId is not a collaborator on map $id" }
    }
}


