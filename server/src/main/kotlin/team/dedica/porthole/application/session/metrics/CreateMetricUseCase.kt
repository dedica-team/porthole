package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.QualityMetric
import java.util.UUID

@Component
class CreateMetricUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(mapId: UUID, callerId: UUID, name: String, description: String): SessionState {
        val state = authorizationPort.accessSession(callerId, mapId, SessionRole.COLLABORATOR)
        require(name.isNotBlank()) { "Metric name must not be empty" }
        val id = UUID.randomUUID()
        state.metrics[id] = QualityMetric(id = id, name = name.trim(), description = description.trim())
        sessionStatePort.save(state)
        broadcastPort.sendMetrics(mapId, state.metrics)
        return state
    }
}
