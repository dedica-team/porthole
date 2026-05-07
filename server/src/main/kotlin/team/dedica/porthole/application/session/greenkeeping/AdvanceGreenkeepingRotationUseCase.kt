package team.dedica.porthole.application.session.greenkeeping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.SessionRole
import java.time.Instant
import java.util.UUID

@Component
class AdvanceGreenkeepingRotationUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, rotationId: UUID, callerId: UUID): GreenkeepingRotation {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val rotation = state.greenkeepingRotations[rotationId]
            ?: throw NoSuchElementException("Greenkeeping rotation $rotationId not found")
        require(rotation.collaborators.isNotEmpty()) { "Greenkeeping rotation $rotationId has no collaborators" }

        var active = rotation.collaborators.firstOrNull { !it.done }
        if (active == null) {
            rotation.collaborators.forEach { it.done = false }
            active = rotation.collaborators.firstOrNull()
        }
        active ?: throw IllegalStateException("Greenkeeping rotation $rotationId has no collaborators")
        active.done = true
        if (rotation.collaborators.all { it.done }) {
            rotation.collaborators.forEach { it.done = false }
        }
        rotation.updatedAt = Instant.now()
        rotation.updatedBy = callerId
        sessionStatePort.save(state)
        broadcastPort.sendGreenkeepingRotations(sessionId, state.greenkeepingRotations)
        return rotation
    }
}

