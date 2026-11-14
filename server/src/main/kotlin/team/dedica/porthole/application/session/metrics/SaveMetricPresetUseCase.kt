package team.dedica.porthole.application.session.metrics

import jakarta.inject.Singleton
import team.dedica.porthole.adapter.`in`.web.dto.MetricTransformationPresetDto
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.MetricTransformationPreset
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.time.Instant
import java.util.UUID

@Singleton
class SaveMetricPresetUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {

    fun execute(
        sessionId: UUID,
        callerId: UUID,
        metricId: UUID,
        presetDto: MetricTransformationPresetDto,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val metric = state.metrics[metricId]
            ?: throw NoSuchElementException("Metric $metricId not found")

        require(presetDto.name.isNotBlank()) { "Preset name must not be blank" }
        require(presetDto.requestUrl.isNotBlank()) { "Preset request URL must not be blank" }

        val presetId = presetDto.id ?: UUID.randomUUID()
        val updatedPreset = MetricTransformationPreset(
            id = presetId,
            name = presetDto.name.trim(),
            metricId = metricId,
            requestUrl = presetDto.requestUrl.trim(),
            httpMethod = presetDto.httpMethod.trim().uppercase(),
            jqFilter = presetDto.jqFilter.trim().ifBlank { "." },
            matchBy = presetDto.matchBy,
            matchKey = presetDto.matchKey?.trim()?.ifBlank { null },
            lastPayloadSample = presetDto.lastPayloadSample,
            updatedAt = Instant.now(),
        )

        val updatedPresets = metric.presets.filter { it.id != presetId } + updatedPreset
        state.metrics[metricId] = metric.copy(presets = updatedPresets)

        sessionStatePort.save(state)
        broadcastPort.sendMetrics(sessionId, state.metrics)
        return state
    }
}
