package team.dedica.porthole.adapter.`in`.web.security

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.security.web.authentication.AuthenticationSuccessHandler
import org.springframework.stereotype.Component
import team.dedica.porthole.adapter.`in`.web.KeycloakOAuthService
import team.dedica.porthole.adapter.`in`.web.KeycloakUserInfo

/**
 * Invoked by Spring Security after a successful Keycloak OIDC login.
 * Extracts user attributes from the [OAuth2User] principal, upserts the porthole user,
 * issues a porthole JWT cookie, and redirects to the frontend callback URL.
 */
@Component
class KeycloakLoginSuccessHandler(
    private val keycloakOAuthService: KeycloakOAuthService,
    private val jwtTokenProvider: JwtTokenProvider,
    private val authCookieService: AuthCookieService,
    @param:Value("\${porthole.keycloak.redirect-uri:http://localhost:5173/auth/keycloak/callback}")
    private val frontendCallbackUrl: String,
) : AuthenticationSuccessHandler {

    private val log = LoggerFactory.getLogger(KeycloakLoginSuccessHandler::class.java)

    override fun onAuthenticationSuccess(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authentication: Authentication,
    ) {
        val principal = authentication.principal

        val userInfo = when (principal) {
            is OidcUser -> KeycloakUserInfo(
                keycloakId = principal.subject ?: run {
                    log.warn("Keycloak OIDC login: missing subject claim")
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED)
                    return
                },
                username = (principal.preferredUsername ?: principal.subject).lowercase()
                    .replace(Regex("[^a-z0-9_-]"), "-"),
                email = principal.email,
                avatarUrl = principal.picture,
            )
            is OAuth2User -> {
                val sub = principal.getAttribute<String>("sub") ?: run {
                    log.warn("Keycloak OAuth2 login: missing sub attribute")
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED)
                    return
                }
                KeycloakUserInfo(
                    keycloakId = sub,
                    username = (principal.getAttribute<String>("preferred_username") ?: sub).lowercase()
                        .replace(Regex("[^a-z0-9_-]"), "-"),
                    email = principal.getAttribute("email"),
                    avatarUrl = principal.getAttribute("picture"),
                )
            }
            else -> {
                log.warn("Keycloak login: unexpected principal type {}", principal?.javaClass)
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED)
                return
            }
        }

        val user = keycloakOAuthService.upsertUser(userInfo)
        val token = jwtTokenProvider.generateToken(user.id, user.username)
        response.addHeader("Set-Cookie", authCookieService.createAuthCookie(token).toString())
        response.sendRedirect(frontendCallbackUrl)
    }
}

