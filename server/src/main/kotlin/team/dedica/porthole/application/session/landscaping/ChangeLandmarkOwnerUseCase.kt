package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class ChangeLandmarkOwnerUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    /** [newOwnerId] may be null to clear the owner. */
    fun execute(sessionId: UUID, callerId: UUID, landmarkId: UUID, newOwnerId: UUID?): SessionState {

        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        if (newOwnerId != null) {
            require(state.isCollaborator(newOwnerId)) {
                "New owner $newOwnerId is not a collaborator in session $sessionId"
            }
        }
        state.landmarks[landmarkId] = landmark.copy(ownerId = newOwnerId)
        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}
