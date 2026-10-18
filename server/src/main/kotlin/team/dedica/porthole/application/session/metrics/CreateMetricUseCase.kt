package team.dedica.porthole.application.session.metrics

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.QualityMetric
import java.util.UUID

@Singleton
class CreateMetricUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID, name: String, description: String, link: String? = null): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        require(name.isNotBlank()) { "Metric name must not be empty" }
        val id = UUID.randomUUID()
        state.metrics[id] = QualityMetric(id = id, name = name.trim(), description = description.trim(), link = link?.trim()?.ifBlank { null })
        sessionStatePort.save(state)
        broadcastPort.sendMetrics(sessionId, state.metrics)
        return state
    }
}
