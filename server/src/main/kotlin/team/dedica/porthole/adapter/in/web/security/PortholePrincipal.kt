package team.dedica.porthole.adapter.`in`.web.security

import team.dedica.porthole.domain.AccessDeniedException
import java.security.Principal
import java.util.*

/**
 * Authenticated caller, resolved from a Porthole session, JWT, or scoped token.
 * Replaces the former Spring `UserDetails` implementation.
 */
data class PortholePrincipal(
    val userId: UUID,
    val username: String,
    val attributes: Map<String, Any?> = emptyMap(),
) : Principal {
    override fun getName(): String = username

    val roles: List<String> get() = listOf("USER")

    val scope: String? get() = attributes[SCOPE_ATTRIBUTE]?.toString()
    val scopedSessionId: UUID? get() = (attributes[SESSION_ID_ATTRIBUTE]?.toString())?.let { runCatching { UUID.fromString(it) }.getOrNull() }
    val scopedMetricId: UUID? get() = (attributes[METRIC_ID_ATTRIBUTE]?.toString())?.let { runCatching { UUID.fromString(it) }.getOrNull() }

    fun isPushToken(): Boolean = scope == SCOPE_PUSH_METRIC

    fun requireFullAccess() {
        if (isPushToken()) {
            throw AccessDeniedException("Push-scoped tokens are only permitted for metric value ingestion")
        }
    }

    companion object {
        const val USER_ID_ATTRIBUTE = "userId"
        const val SESSION_ID_ATTRIBUTE = "sessionId"
        const val METRIC_ID_ATTRIBUTE = "metricId"
        const val SCOPE_ATTRIBUTE = "scope"
        const val SCOPE_PUSH_METRIC = "metric:push"
    }
}
