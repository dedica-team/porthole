package team.dedica.porthole.application.session.metrics

import jakarta.inject.Singleton
import team.dedica.porthole.adapter.`in`.web.security.ScopedJwtService
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class GeneratePushTokenUseCase(
    private val authorizationPort: AuthorizationPort,
    private val scopedJwtService: ScopedJwtService,
) {
    fun execute(sessionId: UUID, callerId: UUID, metricId: UUID): String {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val metric = state.metrics[metricId]
            ?: throw NoSuchElementException("Metric '$metricId' not found")

        return scopedJwtService.generatePushToken(
            userId = callerId,
            username = "ci-metric-push",
            sessionId = sessionId,
            metricId = metric.id,
        )
    }
}
