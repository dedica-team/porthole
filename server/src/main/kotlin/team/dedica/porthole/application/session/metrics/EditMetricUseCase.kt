package team.dedica.porthole.application.session.metrics
import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID
@Component
class EditMetricUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID, metricId: UUID, name: String?, description: String?, link: String?, clearLink: Boolean): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val existing = state.metrics[metricId] ?: throw NoSuchElementException("Metric $metricId not found")
        if (name != null) require(name.isNotBlank()) { "Metric name must not be empty" }
        val newLink = when {
            clearLink -> null
            link != null -> link.trim().ifBlank { null }
            else -> existing.link
        }
        state.metrics[metricId] = existing.copy(name = name?.trim() ?: existing.name, description = description?.trim() ?: existing.description, link = newLink)
        sessionStatePort.save(state)
        broadcastPort.sendMetrics(sessionId, state.metrics)
        return state
    }
}
