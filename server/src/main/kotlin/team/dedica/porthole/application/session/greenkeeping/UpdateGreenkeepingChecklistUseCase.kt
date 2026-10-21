package team.dedica.porthole.application.session.greenkeeping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GreenkeepingChecklistItem
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.SessionRole
import java.time.Instant
import java.util.UUID

@Singleton
class UpdateGreenkeepingChecklistUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        rotationId: UUID,
        title: String?,
        items: List<GreenkeepingChecklistItemPatch>?,
        callerId: UUID,
    ): GreenkeepingRotation {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val rotation = state.greenkeepingRotations[rotationId]
            ?: throw NoSuchElementException("Greenkeeping rotation $rotationId not found")

        val checklist = rotation.currentChecklist
            ?: throw IllegalStateException("Greenkeeping rotation $rotationId has no active checklist")

        if (title != null) {
            val trimmedTitle = title.trim()
            require(trimmedTitle.isNotBlank()) { "Checklist title must not be blank" }
            checklist.title = trimmedTitle
        }

        if (items != null) {
            checklist.items.clear()
            checklist.items += items.map { patch ->
                GreenkeepingChecklistItem(
                    id = patch.id ?: UUID.randomUUID(),
                    title = normalizeTaskTemplateTitle(patch.title),
                    done = patch.done,
                    note = normalizeOptionalNote(patch.note),
                )
            }
        }

        rotation.updatedAt = Instant.now()
        rotation.updatedBy = callerId

        sessionStatePort.save(state)
        broadcastPort.sendGreenkeepingRotations(sessionId, state.greenkeepingRotations)
        return rotation
    }
}
