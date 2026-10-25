package team.dedica.porthole.application.session.landscaping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
class RemoveLandmarkUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID, landmarkId: UUID): SessionState {

        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        state.landmarks[landmarkId] ?: throw NoSuchElementException("Landmark $landmarkId not found")
        val connectionIdsToRemove = state.connections.values
            .filter { it.originId == landmarkId || it.targetId == landmarkId }
            .map { it.id }
        connectionIdsToRemove.forEach { state.connections.remove(it) }
        // Cascade: remove StageConnection entries referencing any of the removed connections
        state.processes.values.forEach { process ->
            process.stages.forEach { stage ->
                stage.connections.removeIf { it.connectionId in connectionIdsToRemove }
            }
        }
        state.landmarks.remove(landmarkId)
        // clean up collaborator matrix entries for the removed landmark
        state.collaboratorMatrix.entries.remove(landmarkId)
        // clean up chore list entries for the removed landmark
        state.choreLists.values.forEach { it.entries.remove(landmarkId) }
        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}