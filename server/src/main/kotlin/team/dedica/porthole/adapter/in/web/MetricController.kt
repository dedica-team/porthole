package team.dedica.porthole.adapter.`in`.web

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.metrics.*
import team.dedica.porthole.domain.QualityLevel
import java.util.UUID

@RestController
@RequestMapping("/api/sessions/{id}/metrics")
class MetricController(
    private val listMetricsUseCase: ListMetricsUseCase,
    private val createMetricUseCase: CreateMetricUseCase,
    private val editMetricUseCase: EditMetricUseCase,
    private val removeMetricUseCase: RemoveMetricUseCase,
) {
    @GetMapping
    fun listMetrics(@PathVariable id: String, @AuthenticationPrincipal user: PortholePrincipal): ResponseEntity<*> =
        ResponseEntity.ok(listMetricsUseCase.execute(UUID.fromString(id), user.userId))

    @PostMapping
    fun createMetric(
        @PathVariable id: String,
        @Valid @RequestBody request: CreateMetricRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<*> =
        ResponseEntity.ok(
            createMetricUseCase.execute(
                UUID.fromString(id),
                user.userId,
                request.name,
                request.description,
                request.link
            )
        )

    @PatchMapping("/{metricId}")
    fun editMetric(
        @PathVariable id: String,
        @PathVariable metricId: String,
        @Valid @RequestBody request: EditMetricRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<*> =
        ResponseEntity.ok(
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

    @DeleteMapping("/{metricId}")
    fun removeMetric(
        @PathVariable id: String,
        @PathVariable metricId: String,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<*> =
        ResponseEntity.ok(removeMetricUseCase.execute(UUID.fromString(id), user.userId, UUID.fromString(metricId)))
}

@RestController
@RequestMapping("/api/sessions/{id}/landmarks/{landmarkId}/metrics")
class LandmarkMetricController(
    private val setLandmarkMetricUseCase: SetLandmarkMetricUseCase,
    private val clearLandmarkMetricUseCase: ClearLandmarkMetricUseCase,
) {
    @PutMapping("/{metricId}")
    fun setLandmarkMetric(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable metricId: String,
        @Valid @RequestBody request: SetLandmarkMetricRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<Any> {
        val level = runCatching { QualityLevel.valueOf(request.level.uppercase()) }.getOrElse {
            return ResponseEntity.badRequest().body("Unknown quality level: ${request.level}")
        }
        return ResponseEntity.ok(
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

    @DeleteMapping("/{metricId}")
    fun clearLandmarkMetric(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable metricId: String,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<*> =
        ResponseEntity.ok(
            clearLandmarkMetricUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(landmarkId),
                UUID.fromString(metricId),
                user.userId
            )
        )
}
