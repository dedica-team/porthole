package team.dedica.porthole.application.session.greenkeeping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.GreenkeepingRotationCollaborator
import team.dedica.porthole.domain.GreenkeepingTaskTemplateItem
import team.dedica.porthole.domain.SessionRole
import java.time.Instant
import java.util.UUID

@Singleton
class CreateGreenkeepingRotationUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        name: String,
        description: String?,
        link: String?,
        groupIds: List<UUID>,
        collaborators: List<GreenkeepingRotationCollaboratorPatch>,
        callerId: UUID,
        taskTemplates: List<GreenkeepingTaskTemplateItemPatch> = emptyList(),
    ): List<GreenkeepingRotation> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        state.validateGreenkeepingGroups(groupIds)
        state.validateGreenkeepingCollaborators(collaborators.map { it.collaboratorId })

        val rotation = GreenkeepingRotation(
            name = normalizeGreenkeepingName(name),
            description = normalizeOptionalDescription(description),
            link = normalizeOptionalLink(link),
            updatedAt = Instant.now(),
            updatedBy = callerId,
        )
        rotation.groupIds += groupIds
        rotation.collaborators += collaborators.map { patch ->
            GreenkeepingRotationCollaborator(collaboratorId = patch.collaboratorId)
        }
        rotation.taskTemplates += taskTemplates.map { patch ->
            GreenkeepingTaskTemplateItem(
                id = patch.id ?: UUID.randomUUID(),
                title = normalizeTaskTemplateTitle(patch.title),
            )
        }

        state.greenkeepingRotations[rotation.id] = rotation
        sessionStatePort.save(state)
        broadcastPort.sendGreenkeepingRotations(sessionId, state.greenkeepingRotations)
        return state.greenkeepingRotations.values.sortedBy { it.name.lowercase() }
    }
}

