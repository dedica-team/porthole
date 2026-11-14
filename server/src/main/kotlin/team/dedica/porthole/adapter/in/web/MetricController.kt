package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.CreateMetricRequest
import team.dedica.porthole.adapter.`in`.web.dto.EditMetricRequest
import team.dedica.porthole.adapter.`in`.web.dto.MetricTransformationDto
import team.dedica.porthole.adapter.`in`.web.dto.PushMetricValuesRequest
import team.dedica.porthole.adapter.`in`.web.dto.PushMetricValuesResponse
import team.dedica.porthole.adapter.`in`.web.dto.SetLandmarkMetricRequest
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.metrics.*
import team.dedica.porthole.domain.QualityLevel
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.util.*

@Controller("/api/sessions/{id}/metrics")
class MetricController(
    private val listMetricsUseCase: ListMetricsUseCase,
    private val createMetricUseCase: CreateMetricUseCase,
    private val editMetricUseCase: EditMetricUseCase,
    private val removeMetricUseCase: RemoveMetricUseCase,
    private val pushMetricValuesUseCase: PushMetricValuesUseCase,
    private val saveMetricTransformationUseCase: SaveMetricTransformationUseCase,
    private val deleteMetricTransformationUseCase: DeleteMetricTransformationUseCase,
) {
    @Get
    fun listMetrics(@PathVariable id: String, user: PortholePrincipal): HttpResponse<*> =
        HttpResponse.ok(listMetricsUseCase.execute(UUID.fromString(id), user.userId))

    @Post
    fun createMetric(
        @PathVariable id: String,
        @Valid @Body request: CreateMetricRequest,
        user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            createMetricUseCase.execute(
                UUID.fromString(id),
                user.userId,
                request.name,
                request.description,
                request.link
            )
        )

    @Patch("/{metricId}")
    fun editMetric(
        @PathVariable id: String,
        @PathVariable metricId: String,
        @Valid @Body request: EditMetricRequest,
        user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            editMetricUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(metricId),
                request.name,
                request.description,
                request.link,
                request.clearLink
            )
        )

    @Delete("/{metricId}")
    fun removeMetric(
        @PathVariable id: String,
        @PathVariable metricId: String,
        user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(removeMetricUseCase.execute(UUID.fromString(id), user.userId, UUID.fromString(metricId)))

    @Post("/{metricIdentifier}/values")
    fun pushMetricValues(
        @PathVariable id: String,
        @PathVariable metricIdentifier: String,
        @Valid @Body request: PushMetricValuesRequest,
        user: PortholePrincipal,
    ): HttpResponse<PushMetricValuesResponse> {
        val decodedIdentifier = URLDecoder.decode(metricIdentifier, StandardCharsets.UTF_8)
        val result = pushMetricValuesUseCase.execute(
            sessionId = UUID.fromString(id),
            callerId = user.userId,
            metricIdentifier = decodedIdentifier,
            request = request,
        )
        return HttpResponse.ok(result)
    }

    @Put("/{metricId}/transformations")
    fun saveTransformation(
        @PathVariable id: String,
        @PathVariable metricId: String,
        @Valid @Body transformationDto: MetricTransformationDto,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            saveMetricTransformationUseCase.execute(
                sessionId = UUID.fromString(id),
                callerId = user.userId,
                metricId = UUID.fromString(metricId),
                transformationDto = transformationDto,
            )
        )

    @Delete("/{metricId}/transformations/{transformationId}")
    fun deleteTransformation(
        @PathVariable id: String,
        @PathVariable metricId: String,
        @PathVariable transformationId: String,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            deleteMetricTransformationUseCase.execute(
                sessionId = UUID.fromString(id),
                callerId = user.userId,
                metricId = UUID.fromString(metricId),
                transformationId = UUID.fromString(transformationId),
            )
        )
}

@Controller("/api/sessions/{id}/landmarks/{landmarkId}/metrics")
class LandmarkMetricController(
    private val setLandmarkMetricUseCase: SetLandmarkMetricUseCase,
    private val clearLandmarkMetricUseCase: ClearLandmarkMetricUseCase,
) {
    @Put("/{metricId}")
    fun setLandmarkMetric(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable metricId: String,
        @Valid @Body request: SetLandmarkMetricRequest,
        user: PortholePrincipal
    ): HttpResponse<*> {
        val level = runCatching { QualityLevel.valueOf(request.level.uppercase()) }.getOrElse {
            return HttpResponse.badRequest("Unknown quality level: ${request.level}")
        }
        return HttpResponse.ok(
            setLandmarkMetricUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(landmarkId),
                UUID.fromString(metricId),
                request.value,
                level,
                request.link,
                request.linkText,
                request.badges,
                user.userId,
                request.description
            )
        )
    }

    @Delete("/{metricId}")
    fun clearLandmarkMetric(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable metricId: String,
        user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            clearLandmarkMetricUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(landmarkId),
                UUID.fromString(metricId),
                user.userId
            )
        )
}
