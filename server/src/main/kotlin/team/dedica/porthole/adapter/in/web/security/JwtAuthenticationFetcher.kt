package team.dedica.porthole.adapter.`in`.web.security

import io.micronaut.core.order.Ordered
import io.micronaut.http.HttpHeaders
import io.micronaut.http.HttpRequest
import io.micronaut.security.authentication.Authentication
import io.micronaut.security.filters.AuthenticationFetcher
import io.micronaut.security.token.validator.TokenValidator
import jakarta.inject.Singleton
import org.reactivestreams.Publisher
import org.slf4j.LoggerFactory
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono

/**
 * Resolves the caller's identity from an asymmetric JWT (via JWKS / TokenValidator)
 * or an opaque session identifier (via UserSessionStore).
 *
 * The token is read from the `Authorization: Bearer` header (REST clients) or the
 * auth cookie (browser WebSocket handshakes and web client requests).
 */
@Singleton
class JwtAuthenticationFetcher(
    private val tokenValidators: Collection<TokenValidator<HttpRequest<*>>>,
    private val authCookieService: AuthCookieService,
    private val userSessionStore: UserSessionStore,
    private val scopedJwtService: ScopedJwtService,
) : AuthenticationFetcher<HttpRequest<*>> {

    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE

    override fun fetchAuthentication(request: HttpRequest<*>): Publisher<Authentication> {
        val token = resolveToken(request) ?: return Mono.empty()

        val session = userSessionStore.getSession(token)
        if (session != null) {
            return Mono.just(
                Authentication.build(
                    session.username,
                    listOf("USER"),
                    mapOf(PortholePrincipal.USER_ID_ATTRIBUTE to session.userId.toString()),
                ),
            )
        }

        val scopedAuth = scopedJwtService.validateToken(token)
        if (scopedAuth != null) {
            return Mono.just(scopedAuth)
        }

        return Flux.fromIterable(tokenValidators)
            .flatMap { validator -> validator.validateToken(token, request) }
            .next()
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
        val log = LoggerFactory.getLogger(JwtAuthenticationFetcher::class.java)
    }
}
