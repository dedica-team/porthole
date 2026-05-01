package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class ClearLandmarkMetricUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(mapId: UUID, landmarkId: UUID, metricId: UUID, callerId: UUID): SessionState {
        val state = authorizationPort.accessSession(callerId, mapId, SessionRole.COLLABORATOR)
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        if (landmark.metrics.containsKey(metricId)) {
            state.landmarks[landmarkId] = landmark.copy(metrics = landmark.metrics - metricId)
            sessionStatePort.save(state)
            broadcastPort.send(mapId, state)
        }
        return state
    }
}