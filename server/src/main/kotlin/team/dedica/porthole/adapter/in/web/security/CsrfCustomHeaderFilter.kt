package team.dedica.porthole.adapter.`in`.web.security

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.MutableHttpResponse
import io.micronaut.http.annotation.Filter
import io.micronaut.http.filter.HttpServerFilter
import io.micronaut.http.filter.ServerFilterChain
import io.micronaut.http.filter.ServerFilterPhase
import jakarta.inject.Singleton
import org.reactivestreams.Publisher
import reactor.core.publisher.Mono
import team.dedica.porthole.adapter.`in`.web.ErrorResponse

/**
 * Stateless CSRF mitigation for cookie-authenticated APIs.
 *
 * Requires that any state-changing request (POST / PUT / PATCH / DELETE) to `/api/`
 * carries a custom header (`X-Requested-With`). Browsers will not attach custom
 * headers on simple cross-origin form submissions or navigations, so this blocks
 * classical CSRF attacks without needing a server-side token store.
 *
 * Requests carrying an `Authorization: Bearer` token are exempt (non-browser
 * clients that explicitly set the header do not need CSRF protection).
 *
 * Runs immediately before the security filter so rejected requests never reach
 * authentication/authorization, mirroring the former Spring filter chain order.
 */
@Filter("/api/**")
@Singleton
class CsrfCustomHeaderFilter : HttpServerFilter {

    override fun getOrder(): Int = ServerFilterPhase.SECURITY.before()

    override fun doFilter(request: HttpRequest<*>, chain: ServerFilterChain): Publisher<MutableHttpResponse<*>> {
        // Defensive path guard: this filter is bound to `/api/**` via @Filter, but
        // keep the non-api exemption explicit so the behaviour is independent of routing.
        if (!request.path.startsWith("/api")) {
            return chain.proceed(request)
        }

        val method = request.methodName.uppercase()

        if (method in SAFE_METHODS) {
            return chain.proceed(request)
        }

        val authHeader = request.headers.get("Authorization")
        if (authHeader != null && authHeader.startsWith("Bearer ", ignoreCase = true)) {
            return chain.proceed(request)
        }

        val customHeader = request.headers.get(CUSTOM_HEADER_NAME)
        if (customHeader.isNullOrBlank()) {
            return Mono.just(
                HttpResponse.status<ErrorResponse>(HttpStatus.FORBIDDEN)
                    .body(ErrorResponse("Missing required header: $CUSTOM_HEADER_NAME", HttpStatus.FORBIDDEN.code)),
            )
        }

        return chain.proceed(request)
    }

    companion object {
        const val CUSTOM_HEADER_NAME = "X-Requested-With"
        private val SAFE_METHODS = setOf("GET", "HEAD", "OPTIONS")
    }
}
