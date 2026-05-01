package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.domain.QualityMetric
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Component
class ListMetricsUseCase(
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(mapId: UUID, callerId: UUID): Map<UUID, QualityMetric> {
        val state = authorizationPort.accessSession(callerId, mapId, SessionRole.VIEWER)
        return state.metrics
    }
}
