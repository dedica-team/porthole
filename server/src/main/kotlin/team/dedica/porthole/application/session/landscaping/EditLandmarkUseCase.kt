package team.dedica.porthole.application.session.landscaping

import jakarta.inject.Singleton
import team.dedica.porthole.application.DataSanitationUtils.cleanLink
import team.dedica.porthole.application.DataSanitationUtils.cleanLinks
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
class EditLandmarkUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        callerId: UUID,
        landmarkId: UUID,
        name: String?,
        type: LandmarkType?,
        description: String? = null,
        groupId: UUID? = null,
        clearGroup: Boolean = false,
        links: Map<String, String>? = null,
        clearLinks: Boolean = false,
        link: String? = null,
        clearLink: Boolean = false,
        ownerId: UUID? = null,
        clearOwner: Boolean = false,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        val newName = if (name != null) {
            require(name.isNotBlank()) { "Landmark name must not be empty" }
            name.trim()
        } else {
            landmark.name
        }
        val newType = type ?: landmark.type
        val newDescription = if (description != null) description.trim().ifBlank { null } else landmark.description
        val newGroupId = when {
            clearGroup -> null
            groupId != null -> {
                require(state.groups.containsKey(groupId)) { "Group $groupId not found" }
                groupId
            }
            else -> landmark.groupId
        }
        val newLinks = when {
            clearLinks || clearLink -> emptyMap()
            links != null -> cleanLinks(links)
            link != null -> {
                val cleaned = cleanLink(link)
                if (cleaned != null) mapOf("default" to cleaned) else emptyMap()
            }
            else -> landmark.links
        }
        val newOwnerId = when {
            clearOwner -> null
            ownerId != null -> {
                require(state.isCollaborator(ownerId)) { "New owner $ownerId is not a collaborator in session $sessionId" }
                ownerId
            }
            else -> landmark.ownerId
        }
        state.landmarks[landmarkId] = landmark.copy(
            name = newName, type = newType, description = newDescription,
            groupId = newGroupId, links = newLinks, ownerId = newOwnerId,
            metrics = landmark.metrics,
        )
        if (landmark.type == LandmarkType.RUINS && newType != LandmarkType.RUINS) {
            state.gameState.buildingHealth[landmarkId] = state.gameState.buildingMaxHealth
        }
        if (landmark.type == LandmarkType.WATCHTOWER && newType != LandmarkType.WATCHTOWER) {
            state.gameState.towerOccupants.remove(landmarkId)
        }
        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}
