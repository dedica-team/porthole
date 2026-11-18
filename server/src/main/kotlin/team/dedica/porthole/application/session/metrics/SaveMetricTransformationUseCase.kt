package team.dedica.porthole.application.session.metrics

import jakarta.inject.Singleton
import team.dedica.porthole.adapter.`in`.web.dto.MetricTransformationDto
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.MetricTransformation
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.time.Instant
import java.util.UUID

@Singleton
class SaveMetricTransformationUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {

    fun execute(
        sessionId: UUID,
        callerId: UUID,
        metricId: UUID,
        transformationDto: MetricTransformationDto,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val metric = state.metrics[metricId]
            ?: throw NoSuchElementException("Metric $metricId not found")

        require(transformationDto.name.isNotBlank()) { "Transformation name must not be blank" }
        require(transformationDto.requestUrl.isNotBlank()) { "Transformation request URL must not be blank" }

        val trimmedName = transformationDto.name.trim()
        val id = transformationDto.id ?: UUID.randomUUID()

        // Ensure transformation names are unique within the metric (case-insensitive)
        require(metric.transformations.none { it.id != id && it.name.equals(trimmedName, ignoreCase = true) }) {
            "A transformation with the name '$trimmedName' already exists"
        }

        val updated = MetricTransformation(
            id = id,
            name = trimmedName,
            metricId = metricId,
            requestUrl = transformationDto.requestUrl.trim(),
            httpMethod = transformationDto.httpMethod.trim().uppercase(),
            parameters = transformationDto.parameters.mapNotNull { (k, v) ->
                val tk = k.trim()
                val tv = v.trim()
                if (tk.isNotEmpty()) tk to tv else null
            }.toMap(),
            authHeader = transformationDto.authHeader?.trim()?.ifBlank { null },
            requestBody = transformationDto.requestBody?.trim()?.ifBlank { null },
            jqFilter = transformationDto.jqFilter.trim().ifBlank { "." },
            matchBy = transformationDto.matchBy,
            matchKey = transformationDto.matchKey?.trim()?.ifBlank { null },
            lastPayloadSample = transformationDto.lastPayloadSample,
            updatedAt = Instant.now(),
        )

        val transformations = metric.transformations.filter { it.id != id } + updated
        state.metrics[metricId] = metric.copy(transformations = transformations)

        sessionStatePort.save(state)
        broadcastPort.sendMetrics(sessionId, state.metrics)
        return state
    }
}
