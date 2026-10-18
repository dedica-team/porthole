package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import team.dedica.porthole.adapter.`in`.web.security.AuthenticationPrincipal
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Delete
import io.micronaut.http.annotation.Get
import io.micronaut.http.annotation.Patch
import io.micronaut.http.annotation.PathVariable
import io.micronaut.http.annotation.Post
import io.micronaut.http.annotation.Put
import io.micronaut.http.annotation.QueryValue
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.metrics.*
import team.dedica.porthole.domain.QualityLevel
import java.util.UUID

@Controller("/api/sessions/{id}/metrics")
class MetricController(
    private val listMetricsUseCase: ListMetricsUseCase,
    private val createMetricUseCase: CreateMetricUseCase,
    private val editMetricUseCase: EditMetricUseCase,
    private val removeMetricUseCase: RemoveMetricUseCase,
) {
    @Get
    fun listMetrics(@PathVariable id: String, @AuthenticationPrincipal user: PortholePrincipal): HttpResponse<*> =
        HttpResponse.ok(listMetricsUseCase.execute(UUID.fromString(id), user.userId))

    @Post
    fun createMetric(
        @PathVariable id: String,
        @Valid @Body request: CreateMetricRequest,
        @AuthenticationPrincipal user: PortholePrincipal
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
        @AuthenticationPrincipal user: PortholePrincipal
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
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(removeMetricUseCase.execute(UUID.fromString(id), user.userId, UUID.fromString(metricId)))
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
        @AuthenticationPrincipal user: PortholePrincipal
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
        @AuthenticationPrincipal user: PortholePrincipal
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
