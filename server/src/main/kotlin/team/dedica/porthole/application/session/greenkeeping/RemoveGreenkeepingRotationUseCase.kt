package team.dedica.porthole.application.session.greenkeeping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class RemoveGreenkeepingRotationUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, rotationId: UUID, callerId: UUID): List<GreenkeepingRotation> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        state.greenkeepingRotations.remove(rotationId)
            ?: throw NoSuchElementException("Greenkeeping rotation $rotationId not found")
        sessionStatePort.save(state)
        broadcastPort.sendGreenkeepingRotations(sessionId, state.greenkeepingRotations)
        return state.greenkeepingRotations.values.sortedBy { it.name.lowercase() }
    }
}

