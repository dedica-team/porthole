package team.dedica.porthole.application.session.greenkeeping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.GreenkeepingRotationCollaborator
import team.dedica.porthole.domain.SessionRole
import java.time.Instant
import java.util.UUID

@Singleton
class EditGreenkeepingRotationUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        rotationId: UUID,
        name: String?,
        description: String?,
        clearDescription: Boolean,
        link: String?,
        clearLink: Boolean,
        groupIds: List<UUID>?,
        collaborators: List<GreenkeepingRotationCollaboratorPatch>?,
        callerId: UUID,
    ): List<GreenkeepingRotation> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val rotation = state.greenkeepingRotations[rotationId]
            ?: throw NoSuchElementException("Greenkeeping rotation $rotationId not found")

        if (name != null) {
            rotation.name = normalizeGreenkeepingName(name)
        }
        when {
            clearDescription -> rotation.description = null
            description != null -> rotation.description = normalizeOptionalDescription(description)
        }
        when {
            clearLink -> rotation.link = null
            link != null -> rotation.link = normalizeOptionalLink(link)
        }
        if (groupIds != null) {
            state.validateGreenkeepingGroups(groupIds)
            rotation.groupIds.clear()
            rotation.groupIds += groupIds
        }
        if (collaborators != null) {
            state.validateGreenkeepingCollaborators(collaborators.map { it.collaboratorId })
            val existingById = rotation.collaborators.associateBy { it.id }
            val reordered = collaborators.map { patch ->
                val existing = patch.id?.let(existingById::get)
                if (existing != null && existing.collaboratorId == patch.collaboratorId) {
                    existing
                } else {
                    GreenkeepingRotationCollaborator(collaboratorId = patch.collaboratorId)
                }
            }
            rotation.collaborators.clear()
            rotation.collaborators += reordered
        }

        rotation.updatedAt = Instant.now()
        rotation.updatedBy = callerId
        sessionStatePort.save(state)
        broadcastPort.sendGreenkeepingRotations(sessionId, state.greenkeepingRotations)
        return state.greenkeepingRotations.values.sortedBy { it.name.lowercase() }
    }
}

