package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import io.micronaut.http.annotation.Post
import io.micronaut.http.annotation.QueryValue
import io.micronaut.http.cookie.Cookie
import io.micronaut.http.cookie.SameSite
import team.dedica.porthole.adapter.`in`.web.security.*
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.config.PortholeAuthProperties
import java.time.Duration
import java.util.*

data class AuthResponse(
    val userId: UUID,
    val username: String,
    val avatarUrl: String?,
    val token: String? = null,
    val isAdmin: Boolean = false,
    val githubEnabled: Boolean = false,
    val keycloakEnabled: Boolean = false
)

data class AuthFeatures(
    val githubEnabled: Boolean,
    val keycloakEnabled: Boolean = false,
    val webAuthnEnabled: Boolean = true,
    val tagline: String = "for teams"
)

data class OAuthStartResponse(val authorizationUrl: String)

@Controller("/api/auth")
class OAuthController(
    private val gitHubOAuthService: GitHubOAuthService,
    private val gitHubOAuthStateService: GitHubOAuthStateService,
    private val jwtTokenProvider: JwtTokenProvider,
    private val authCookieService: AuthCookieService,
    private val userRepository: UserPort,
    private val adminService: AdminService,
    private val props: PortholeAuthProperties,
) {
    private val githubEnabled: Boolean get() = props.github.isEnabled()
    private val keycloakEnabled: Boolean get() = props.keycloak.isEnabled()
    private val webAuthnEnabled: Boolean get() = props.webauthn.isEnabled()
    private val githubRedirectUri: String get() = props.github.redirectUri

    @Get("/config")
    fun config(): AuthFeatures = AuthFeatures(githubEnabled, keycloakEnabled, webAuthnEnabled, props.tagline)

    @Post("/github/start")
    fun githubStart(): HttpResponse<OAuthStartResponse> {
        val state = gitHubOAuthStateService.issueState()
        val authorizationUrl = gitHubOAuthService.buildAuthorizationUrl(state, githubRedirectUri)
        return HttpResponse.ok(OAuthStartResponse(authorizationUrl)).cookie(stateCookie(state))
    }

    @Post("/github/callback")
    fun githubCallback(
        @QueryValue code: String,
        @QueryValue state: String?,
        request: HttpRequest<*>,
    ): HttpResponse<AuthResponse> {
        val clearStateCookie = clearStateCookie()
        val expectedState = request.cookies.findCookie(GitHubOAuthStateService.STATE_COOKIE_NAME)
            .map { it.value }
            .orElse(null)

        if (!gitHubOAuthStateService.isValidCallbackState(expectedState, state)) {
            return HttpResponse.status<AuthResponse>(HttpStatus.UNAUTHORIZED).cookie(clearStateCookie)
        }

        val accessToken = gitHubOAuthService.exchangeCodeForToken(code, githubRedirectUri)
            ?: return HttpResponse.status<AuthResponse>(HttpStatus.UNAUTHORIZED).cookie(clearStateCookie)
        val userInfo = gitHubOAuthService.fetchUserInfo(accessToken)
            ?: return HttpResponse.status<AuthResponse>(HttpStatus.UNAUTHORIZED).cookie(clearStateCookie)
        val user = gitHubOAuthService.upsertUser(userInfo)
        val token = jwtTokenProvider.generateToken(user.id, user.username)
        return HttpResponse.ok(
            AuthResponse(
                user.id,
                user.username,
                user.avatarUrl,
                isAdmin = adminService.isAdmin(user.id),
                githubEnabled = githubEnabled,
                keycloakEnabled = keycloakEnabled
            )
        )
            .cookie(clearStateCookie)
            .cookie(authCookieService.createAuthCookie(token))
    }

    @Get("/session")
    fun session( user: PortholePrincipal?): HttpResponse<AuthResponse> {
        val authenticatedUser = user ?: return HttpResponse.unauthorized()
        val userRecord = userRepository.findByUsername(authenticatedUser.username)
            ?: return HttpResponse.unauthorized()
        return HttpResponse.ok(
            AuthResponse(
                userRecord.id,
                userRecord.username,
                userRecord.avatarUrl,
                isAdmin = adminService.isAdmin(userRecord.id),
                githubEnabled = githubEnabled,
                keycloakEnabled = keycloakEnabled
            )
        )
    }

    @Post("/logout")
    fun logout(): HttpResponse<*> =
        HttpResponse.noContent<Any>().cookie(authCookieService.clearAuthCookie())

    private fun stateCookie(state: String): Cookie =
        Cookie.of(GitHubOAuthStateService.STATE_COOKIE_NAME, state)
            .httpOnly(true)
            .secure(githubRedirectUri.startsWith("https://"))
            .sameSite(SameSite.Lax)
            .path(GitHubOAuthStateService.STATE_COOKIE_PATH)
            .maxAge(Duration.ofSeconds(GitHubOAuthStateService.STATE_TTL_SECONDS))

    private fun clearStateCookie(): Cookie =
        Cookie.of(GitHubOAuthStateService.STATE_COOKIE_NAME, "")
            .httpOnly(true)
            .secure(githubRedirectUri.startsWith("https://"))
            .sameSite(SameSite.Lax)
            .path(GitHubOAuthStateService.STATE_COOKIE_PATH)
            .maxAge(Duration.ZERO)
}
