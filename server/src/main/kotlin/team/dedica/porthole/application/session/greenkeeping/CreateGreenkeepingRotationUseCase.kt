package team.dedica.porthole.application.session.greenkeeping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.GreenkeepingRotationCollaborator
import team.dedica.porthole.domain.SessionRole
import java.time.Instant
import java.util.UUID

@Component
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

        state.greenkeepingRotations[rotation.id] = rotation
        sessionStatePort.save(state)
        broadcastPort.sendGreenkeepingRotations(sessionId, state.greenkeepingRotations)
        return state.greenkeepingRotations.values.sortedBy { it.name.lowercase() }
    }
}

