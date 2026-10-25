package team.dedica.porthole.application.session.greenkeeping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.SessionRole
import java.time.Instant
import java.util.UUID

@Singleton
class FinishGreenkeepingChecklistUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        rotationId: UUID,
        callerId: UUID,
    ): GreenkeepingRotation {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val rotation = state.greenkeepingRotations[rotationId]
            ?: throw NoSuchElementException("Greenkeeping rotation $rotationId not found")

        val checklist = rotation.currentChecklist
            ?: throw IllegalStateException("Greenkeeping rotation $rotationId has no active checklist")

        checklist.finishedAt = Instant.now()
        checklist.finishedBy = callerId

        rotation.completedChecklists += checklist
        rotation.currentChecklist = null
        rotation.updatedAt = Instant.now()
        rotation.updatedBy = callerId

        sessionStatePort.save(state)
        broadcastPort.sendGreenkeepingRotations(sessionId, state.greenkeepingRotations)
        return rotation
    }
}
