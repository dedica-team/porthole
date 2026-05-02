package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class ClearMatrixEntryUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID, landmarkId: UUID, collaboratorId: UUID): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val byLandmark = state.collaboratorMatrix.entries[landmarkId]
        if (byLandmark != null) {
            byLandmark.remove(collaboratorId)
            if (byLandmark.isEmpty()) state.collaboratorMatrix.entries.remove(landmarkId)
            sessionStatePort.save(state)
            broadcastPort.sendMatrix(sessionId, state.collaboratorMatrix)
        }
        return state
    }
}