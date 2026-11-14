package team.dedica.porthole.application.session.metrics

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
class DeleteMetricPresetUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {

    fun execute(
        sessionId: UUID,
        callerId: UUID,
        metricId: UUID,
        presetId: UUID,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val metric = state.metrics[metricId]
            ?: throw NoSuchElementException("Metric $metricId not found")

        val updatedPresets = metric.presets.filter { it.id != presetId }
        state.metrics[metricId] = metric.copy(presets = updatedPresets)

        sessionStatePort.save(state)
        broadcastPort.sendMetrics(sessionId, state.metrics)
        return state
    }
}
