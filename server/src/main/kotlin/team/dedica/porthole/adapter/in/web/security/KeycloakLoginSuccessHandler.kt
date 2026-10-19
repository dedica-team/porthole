package team.dedica.porthole.adapter.`in`.web.security

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpResponse
import io.micronaut.http.MutableHttpResponse
import io.micronaut.security.authentication.Authentication
import io.micronaut.security.authentication.AuthenticationResponse
import io.micronaut.security.handlers.RedirectingLoginHandler
import jakarta.inject.Singleton
import org.slf4j.LoggerFactory
import team.dedica.porthole.adapter.`in`.web.KeycloakOAuthService
import team.dedica.porthole.adapter.`in`.web.KeycloakUserInfo
import team.dedica.porthole.config.PortholeAuthProperties
import java.net.URI

/**
 * Micronaut replacement for the former Spring Security `KeycloakLoginSuccessHandler`.
 *
 * Micronaut's built-in OAuth2 authorization-code flow (configured under
 * `micronaut.security.oauth2.clients.keycloak`) performs OIDC discovery, the authorization
 * redirect and the code-for-token exchange, then delegates the post-login response to a
 * [RedirectingLoginHandler]. Providing this bean has two effects:
 *
 *  1. it enables `DefaultOauthController`, which is
 *     `@Requires(beans = RedirectingLoginHandler.class)` and dynamically registers the
 *     `/oauth2/authorization/{provider}` and `/login/oauth2/code/{provider}` routes the
 *     client already calls; and
 *  2. it restores the three steps the deleted Spring handler performed after a successful
 *     Keycloak login: upsert the Porthole user, issue the Porthole JWT cookie, and redirect
 *     to the configured frontend callback.
 *
 * The OIDC claims are surfaced by Micronaut's `DefaultOpenIdAuthenticationMapper`:
 * [Authentication.getName] is the `sub` claim and the remaining (non-registered) ID-token
 * claims (`preferred_username`, `email`, `picture`) are exposed as attributes.
 */
@Singleton
class KeycloakLoginSuccessHandler(
    private val keycloakOAuthService: KeycloakOAuthService,
    private val jwtTokenProvider: JwtTokenProvider,
    private val authCookieService: AuthCookieService,
    props: PortholeAuthProperties,
) : RedirectingLoginHandler<HttpRequest<*>, MutableHttpResponse<*>> {

    private val log = LoggerFactory.getLogger(KeycloakLoginSuccessHandler::class.java)
    private val frontendCallbackUrl: String = props.keycloak.redirectUri

    override fun loginSuccess(
        authentication: Authentication,
        request: HttpRequest<*>,
    ): MutableHttpResponse<*> {
        val attributes = authentication.attributes
        val keycloakId = (attributes[CLAIM_SUB] as? String)?.takeIf { it.isNotBlank() }
            ?: authentication.name?.takeIf { it.isNotBlank() }
        if (keycloakId == null) {
            log.warn("Keycloak login: principal is missing a subject claim")
            return redirectToFrontend()
        }

        val user = keycloakOAuthService.upsertUser(
            KeycloakUserInfo(
                keycloakId = keycloakId,
                username = (attributes[CLAIM_PREFERRED_USERNAME] as? String)
                    ?.takeIf { it.isNotBlank() } ?: keycloakId,
                email = attributes[CLAIM_EMAIL] as? String,
                avatarUrl = attributes[CLAIM_PICTURE] as? String,
            ),
        )
        val token = jwtTokenProvider.generateToken(user.id, user.username)
        log.debug("Keycloak login established a Porthole session for user {}", user.username)
        return redirectToFrontend().cookie(authCookieService.createAuthCookie(token))
    }

    /**
     * Refresh tokens are not part of the Porthole cookie session; a refresh login is
     * treated as unauthorized rather than silently re-issuing a session.
     */
    override fun loginRefresh(
        authentication: Authentication,
        refreshToken: String,
        request: HttpRequest<*>,
    ): MutableHttpResponse<*> = HttpResponse.unauthorized<Any>()

    /**
     * Redirects back to the frontend callback without a cookie. The callback page then
     * surfaces the failure because its `getSession()` call returns 401.
     */
    override fun loginFailed(
        authenticationResponse: AuthenticationResponse,
        request: HttpRequest<*>,
    ): MutableHttpResponse<*> {
        log.warn("Keycloak login failed: {}", authenticationResponse.message.orElse("unknown reason"))
        return redirectToFrontend()
    }

    private fun redirectToFrontend(): MutableHttpResponse<Any> =
        HttpResponse.seeOther(URI.create(frontendCallbackUrl))

    private companion object {
        const val CLAIM_SUB = "sub"
        const val CLAIM_PREFERRED_USERNAME = "preferred_username"
        const val CLAIM_EMAIL = "email"
        const val CLAIM_PICTURE = "picture"
    }
}
