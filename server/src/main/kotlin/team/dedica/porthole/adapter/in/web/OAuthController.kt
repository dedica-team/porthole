package team.dedica.porthole.adapter.`in`.web

import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.adapter.`in`.web.security.AuthCookieService
import team.dedica.porthole.adapter.`in`.web.security.GitHubOAuthStateService
import team.dedica.porthole.adapter.`in`.web.security.JwtTokenProvider
import team.dedica.porthole.config.PortholeAuthProperties
import jakarta.servlet.http.HttpServletRequest
import java.time.Duration
import java.util.UUID

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

@RestController
@RequestMapping("/api/auth")
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

    @GetMapping("/config")
    fun config(): AuthFeatures = AuthFeatures(githubEnabled, keycloakEnabled, webAuthnEnabled, props.tagline)

    @PostMapping("/github/start")
    fun githubStart(): ResponseEntity<OAuthStartResponse> {
        val state = gitHubOAuthStateService.issueState()
        val authorizationUrl = gitHubOAuthService.buildAuthorizationUrl(state, githubRedirectUri)
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, stateCookie(state).toString())
            .body(OAuthStartResponse(authorizationUrl))
    }

    @PostMapping("/github/callback")
    fun githubCallback(
        @RequestParam code: String,
        @RequestParam state: String?,
        request: HttpServletRequest,
    ): ResponseEntity<AuthResponse> {
        val clearStateCookie = clearStateCookie().toString()
        val expectedState = request.cookies
            ?.firstOrNull { it.name == GitHubOAuthStateService.STATE_COOKIE_NAME }
            ?.value

        if (!gitHubOAuthStateService.isValidCallbackState(expectedState, state)) {
            return ResponseEntity.status(401)
                .header(HttpHeaders.SET_COOKIE, clearStateCookie)
                .build()
        }

        val accessToken = gitHubOAuthService.exchangeCodeForToken(code, githubRedirectUri)
            ?: return ResponseEntity.status(401).header(HttpHeaders.SET_COOKIE, clearStateCookie).build()
        val userInfo = gitHubOAuthService.fetchUserInfo(accessToken)
            ?: return ResponseEntity.status(401).header(HttpHeaders.SET_COOKIE, clearStateCookie).build()
        val user = gitHubOAuthService.upsertUser(userInfo)
        val token = jwtTokenProvider.generateToken(user.id, user.username)
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, clearStateCookie)
            .header(HttpHeaders.SET_COOKIE, authCookieService.createAuthCookie(token).toString())
            .body(
                AuthResponse(
                    user.id,
                    user.username,
                    user.avatarUrl,
                    isAdmin = adminService.isAdmin(user.id),
                    githubEnabled = githubEnabled,
                    keycloakEnabled = keycloakEnabled
                )
            )
    }

    @GetMapping("/session")
    fun session(@AuthenticationPrincipal user: UserDetails?): ResponseEntity<AuthResponse> {
        val authenticatedUser = user ?: return ResponseEntity.status(401).build()
        val userRecord = userRepository.findByUsername(authenticatedUser.username)
            ?: return ResponseEntity.status(401).build()
        return ResponseEntity.ok(
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

    @PostMapping("/logout")
    fun logout(): ResponseEntity<Void> =
        ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, authCookieService.clearAuthCookie().toString())
            .build()

    private fun stateCookie(state: String): ResponseCookie =
        ResponseCookie.from(GitHubOAuthStateService.STATE_COOKIE_NAME, state)
            .httpOnly(true)
            .secure(githubRedirectUri.startsWith("https://"))
            .sameSite("Lax")
            .path(GitHubOAuthStateService.STATE_COOKIE_PATH)
            .maxAge(Duration.ofSeconds(GitHubOAuthStateService.STATE_TTL_SECONDS))
            .build()

    private fun clearStateCookie(): ResponseCookie =
        ResponseCookie.from(GitHubOAuthStateService.STATE_COOKIE_NAME, "")
            .httpOnly(true)
            .secure(githubRedirectUri.startsWith("https://"))
            .sameSite("Lax")
            .path(GitHubOAuthStateService.STATE_COOKIE_PATH)
            .maxAge(Duration.ZERO)
            .build()
}
