package team.dedica.porthole.adapter.`in`.web

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.CreateMetricRequest
import team.dedica.porthole.adapter.`in`.web.dto.EditMetricRequest
import team.dedica.porthole.adapter.`in`.web.dto.SetLandmarkMetricRequest
import team.dedica.porthole.application.session.metrics.ClearLandmarkMetricUseCase
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.EditMetricUseCase
import team.dedica.porthole.application.session.metrics.RemoveMetricUseCase
import team.dedica.porthole.application.session.metrics.SetLandmarkMetricUseCase
import team.dedica.porthole.domain.QualityLevel

@RestController
@RequestMapping("/api/maps/{id}/metrics")
class MetricController(
    private val createMetricUseCase: CreateMetricUseCase,
    private val editMetricUseCase: EditMetricUseCase,
    private val removeMetricUseCase: RemoveMetricUseCase,
) {
    @PostMapping
    fun createMetric(
        @PathVariable id: String,
        @Valid @RequestBody request: CreateMetricRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<*> =
        ResponseEntity.ok(createMetricUseCase.execute(id, user.username, request.name, request.description))

    @PatchMapping("/{metricId}")
    fun editMetric(
        @PathVariable id: String,
        @PathVariable metricId: String,
        @Valid @RequestBody request: EditMetricRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<*> =
        ResponseEntity.ok(editMetricUseCase.execute(id, user.username, metricId, request.name, request.description))

    @DeleteMapping("/{metricId}")
    fun removeMetric(
        @PathVariable id: String,
        @PathVariable metricId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<*> =
        ResponseEntity.ok(removeMetricUseCase.execute(id, user.username, metricId))
}

@RestController
@RequestMapping("/api/maps/{id}/landmarks/{landmarkId}/metrics")
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
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> {
        val level = runCatching { QualityLevel.valueOf(request.level.uppercase()) }
            .getOrElse { return ResponseEntity.badRequest().body("Unknown quality level: ${request.level}") }
        return ResponseEntity.ok(
            setLandmarkMetricUseCase.execute(id, landmarkId, metricId, request.value, level, request.link, request.badges, user.username)
        )
    }

    @DeleteMapping("/{metricId}")
    fun clearLandmarkMetric(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable metricId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<*> =
        ResponseEntity.ok(clearLandmarkMetricUseCase.execute(id, landmarkId, metricId, user.username))
}
