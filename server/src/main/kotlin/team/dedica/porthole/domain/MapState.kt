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
    val id: UUID = UUID.randomUUID(),
    val map: HexMap,
    val collaborators: MutableList<Collaborator> = mutableListOf(),
    val landmarks: MutableMap<UUID, Landmark> = mutableMapOf(),
    val connections: MutableMap<UUID, Connection> = mutableMapOf(),
    val groups: MutableMap<UUID, LandmarkGroup> = mutableMapOf(),
    val metrics: MutableMap<UUID, QualityMetric> = mutableMapOf(),
    val createdAt: Instant = Instant.now(),
    val name: String? = null,
    val description: String? = null,
    val collaborationMode: CollaborationMode = CollaborationMode.OPEN,
    val joinRequests: MutableList<JoinRequest> = mutableListOf(),
    var collaboratorMatrix: CollaboratorMatrix = CollaboratorMatrix(),
    val processes: MutableMap<UUID, Process> = mutableMapOf(),
    val choreLists: MutableMap<UUID, ChoreList> = mutableMapOf(),
) {

    fun getCollaborator(collaboratorId: UUID): Collaborator? = collaborators.find { it.id == collaboratorId }

    fun getLandmarksOf(collaboratorId: UUID): List<Landmark> =
        landmarks.values.filter { it.ownerId == collaboratorId }

    fun getLandmarkAt(coordinate: HexCoordinate): Landmark? =
        landmarks.values.find { it.coordinate != null && it.coordinate == coordinate }

    fun isCollaborator(userId: UUID): Boolean = collaborators.any { it.id == userId }

    fun hasPendingRequest(userId: UUID): Boolean = joinRequests.any { it.userId == userId }

    fun requireCollaborator(userId: UUID) {
        require(isCollaborator(userId)) { "User $userId is not a collaborator on map $id" }
    }

    fun requireReadAccess(userId: UUID) {
        if (collaborationMode == CollaborationMode.PRIVATE) {
            require(isCollaborator(userId)) { "Map is private" }
        }
    }
}


