package team.dedica.porthole.application.session.metrics
import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID
@Component
class RemoveMetricUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID, metricId: UUID): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        require(state.metrics.containsKey(metricId)) { "Metric $metricId not found" }
        state.metrics.remove(metricId)
        // Cascade: remove this metric's entry from every landmark
        state.landmarks.replaceAll { _, landmark ->
            if (landmark.metrics.containsKey(metricId))
                landmark.copy(metrics = landmark.metrics - metricId)
            else
                landmark
        }
        sessionStatePort.save(state)
        broadcastPort.sendMetrics(sessionId, state.metrics)
        return state
    }
}
