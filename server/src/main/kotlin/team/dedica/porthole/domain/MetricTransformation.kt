package team.dedica.porthole.domain

import java.time.Instant
import java.util.UUID

/**
 * Reusable transformation configuration for ingesting external metric payloads.
 *
 * @param id                unique transformation UUID
 * @param name              human-readable transformation title
 * @param metricId          the metric this transformation belongs to
 * @param requestUrl        target foreign API URL
 * @param httpMethod        HTTP verb used to fetch foreign data
 * @param jqFilter          jq expression transforming foreign response into batch push format
 * @param matchBy           matching strategy (NAME, LINK, or ALIAS)
 * @param matchKey          optional link map key when matching by link
 * @param lastPayloadSample optional cached payload snippet for live preview and dry-runs
 * @param updatedAt         timestamp of last update
 */
data class MetricTransformation(
    val id: UUID = UUID.randomUUID(),
    val name: String,
    val metricId: UUID,
    val requestUrl: String,
    val httpMethod: String = "GET",
    val jqFilter: String = ".",
    val matchBy: MatchStrategy = MatchStrategy.NAME,
    val matchKey: String? = null,
    val lastPayloadSample: String? = null,
    val updatedAt: Instant = Instant.now(),
)
