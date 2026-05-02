package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.CollaboratorMatrixEntry
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.MatrixLevel
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Component
class SetMatrixEntryUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID, landmarkId: UUID, collaboratorId: UUID, level: MatrixLevel): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        require(state.landmarks.containsKey(landmarkId)) { "Landmark $landmarkId not found" }
        require(state.collaborators.any { it.id == collaboratorId }) { "Collaborator $collaboratorId not found" }
        val byLandmark = state.collaboratorMatrix.entries.getOrPut(landmarkId) { ConcurrentHashMap() }
        byLandmark[collaboratorId] = CollaboratorMatrixEntry(level)
        sessionStatePort.save(state)
        broadcastPort.sendMatrix(sessionId, state.collaboratorMatrix)
        return state
    }
}