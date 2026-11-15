package team.dedica.porthole.adapter.`in`.web.dto

import io.micronaut.core.annotation.Introspected
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import team.dedica.porthole.domain.MatchStrategy
import team.dedica.porthole.domain.QualityLevel
import java.util.UUID

@Introspected
data class MetricElementValueDto(
    @field:NotBlank
    val element: String,
    val value: String? = null,
    val level: QualityLevel = QualityLevel.NONE,
    val description: String? = null,
    val link: String? = null,
    val linkText: String? = null,
    val badges: Map<String, String> = emptyMap(),
)

@Introspected
data class PushMetricValuesRequest(
    val matchBy: MatchStrategy = MatchStrategy.NAME,
    val matchKey: String? = null,
    @field:Valid
    val values: List<MetricElementValueDto> = emptyList(),
)

@Introspected
data class PushMetricValuesResponse(
    val updatedCount: Int,
    val unmatchedElements: List<String> = emptyList(),
    val warnings: List<String> = emptyList(),
)

@Introspected
data class MetricTransformationDto(
    val id: UUID? = null,
    @field:NotBlank @field:Size(max = 200)
    val name: String,
    @field:NotBlank
    val requestUrl: String,
    val httpMethod: String = "GET",
    val jqFilter: String = ".",
    val matchBy: MatchStrategy = MatchStrategy.NAME,
    val matchKey: String? = null,
    val lastPayloadSample: String? = null,
)
