package team.dedica.porthole.adapter.`in`.web.security

import io.micronaut.core.order.Ordered
import io.micronaut.http.HttpHeaders
import io.micronaut.http.HttpRequest
import io.micronaut.security.authentication.Authentication
import io.micronaut.security.filters.AuthenticationFetcher
import jakarta.inject.Singleton
import org.reactivestreams.Publisher
import reactor.core.publisher.Mono

/**
 * Resolves the caller's identity from the Porthole JWT.
 *
 * Replaces the former Spring `WebSocketHandshakeAuthInterceptor` / `OncePerRequestFilter`
 * pair: the token is read from the `Authorization: Bearer` header (REST clients) or the
 * auth cookie (browser WebSocket handshakes, which cannot set headers), validated with
 * [JwtTokenProvider] and surfaced to Micronaut Security as an [Authentication].
 *
 * The fetcher is deliberately stateless (no repository lookup per request): the JWT is
 * signed, so its `userId`/`username` claims are trustworthy until they expire. Controllers
 * that need the full user record load it themselves.
 */
@Singleton
class JwtAuthenticationFetcher(
    private val jwtTokenProvider: JwtTokenProvider,
    private val authCookieService: AuthCookieService,
) : AuthenticationFetcher<HttpRequest<*>> {

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE

    override fun fetchAuthentication(request: HttpRequest<*>): Publisher<Authentication> {
        val token = resolveToken(request) ?: return Mono.empty()
        val claims = runCatching { jwtTokenProvider.getTokenClaims(token) }.getOrNull()
            ?: return Mono.empty()

        return Mono.just(
            Authentication.build(
                claims.username,
                listOf("USER"),
                mapOf(PortholePrincipal.USER_ID_ATTRIBUTE to claims.userId.toString()),
            ),
        )
    }

    private fun resolveToken(request: HttpRequest<*>): String? =
        request.headers.get(HttpHeaders.AUTHORIZATION)
            ?.takeIf { it.startsWith(BEARER_PREFIX, ignoreCase = true) }
            ?.substring(BEARER_PREFIX.length)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: authCookieService.resolveToken(request)

    private companion object {
        const val BEARER_PREFIX = "Bearer "
    }
}
