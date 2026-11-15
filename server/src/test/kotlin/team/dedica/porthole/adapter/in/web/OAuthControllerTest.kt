package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.cookie.Cookie
import io.micronaut.http.simple.SimpleHttpRequestFactory
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.adapter.`in`.web.security.AuthCookieService
import team.dedica.porthole.adapter.`in`.web.security.GitHubOAuthStateService
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.adapter.`in`.web.security.UserSessionStore
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.config.PortholeAuthPropertiesTestFactory
import java.util.UUID

class OAuthControllerTest {

    private val gitHubOAuthService = mock<GitHubOAuthService>()
    private val userSessionStore = UserSessionStore()
    private val userRepository = mock<UserPort>()
    private val gitHubOAuthStateService = GitHubOAuthStateService()
    private val props = PortholeAuthPropertiesTestFactory.withGitHub()
    private val authCookieService = AuthCookieService(props)
    private val adminService = AdminService("")
    private lateinit var controller: OAuthController

    @BeforeEach
    fun setUp() {
        controller = OAuthController(
            gitHubOAuthService,
            gitHubOAuthStateService,
            userSessionStore,
            authCookieService,
            userRepository,
            adminService,
            props = props,
        )
    }

    @Test
    fun `existing user by githubId gets a session token`() {
        val id = UUID.nameUUIDFromBytes("u1".toByteArray())
        val token = userSessionStore.createSession(id, "alice")
        assertNotNull(token)
        assertEquals("alice", userSessionStore.getSession(token)?.username)
    }

    @Test
    fun `expired session token is evicted and returns null`() {
        val id = UUID.nameUUIDFromBytes("u1".toByteArray())
        val token = userSessionStore.createSession(id, "alice", ttl = java.time.Duration.ofMillis(-10))
        assertNull(userSessionStore.getSession(token))
    }

    @Test
    fun `githubStart returns authorization url and state cookie`() {
        whenever(gitHubOAuthService.buildAuthorizationUrl(any(), any()))
            .thenReturn("https://github.com/login/oauth/authorize?state=s")

        val response = controller.githubStart()

        assertEquals(HttpStatus.OK, response.status)
        assertEquals("https://github.com/login/oauth/authorize?state=s", response.body.get().authorizationUrl)
        val stateCookie = response.cookies.findCookie(GitHubOAuthStateService.STATE_COOKIE_NAME).orElse(null)
        assertNotNull(stateCookie, "State cookie must be set")
        assertTrue(stateCookie!!.value.isNotBlank())
        verify(gitHubOAuthService).buildAuthorizationUrl(any(), eq("http://localhost:5173/auth/github/callback"))
    }

    @Test
    fun `githubCallback returns 401 when token exchange fails`() {
        whenever(gitHubOAuthService.exchangeCodeForToken(any(), any())).thenReturn(null)
        val response = controller.githubCallback("bad-code", "expected-state", requestWithStateCookie("expected-state"))
        assertEquals(HttpStatus.UNAUTHORIZED, response.status)
    }

    @Test
    fun `githubCallback returns 401 when user info fetch fails`() {
        whenever(gitHubOAuthService.exchangeCodeForToken(any(), any())).thenReturn("valid-token")
        whenever(gitHubOAuthService.fetchUserInfo(any())).thenReturn(null)
        val response = controller.githubCallback("some-code", "expected-state", requestWithStateCookie("expected-state"))
        assertEquals(HttpStatus.UNAUTHORIZED, response.status)
    }

    @Test
    fun `githubCallback returns 401 when oauth state is invalid`() {
        val response = controller.githubCallback("valid-code", "wrong-state", requestWithStateCookie("expected-state"))

        assertEquals(HttpStatus.UNAUTHORIZED, response.status)
        verify(gitHubOAuthService, never()).exchangeCodeForToken(any(), any())
    }

    @Test
    fun `githubCallback returns auth response for valid code`() {
        val id = UUID.nameUUIDFromBytes("u1".toByteArray())
        val userInfo = GitHubUserInfo("gh-1", "alice", "https://avatar.url", "alice@x.com")
        val userRecord = UserRecord(id = id, username = "alice", githubId = "gh-1", avatarUrl = "https://avatar.url")
        whenever(gitHubOAuthService.exchangeCodeForToken("valid-code", "http://localhost:5173/auth/github/callback")).thenReturn("gh-access")
        whenever(gitHubOAuthService.fetchUserInfo("gh-access")).thenReturn(userInfo)
        whenever(gitHubOAuthService.upsertUser(userInfo)).thenReturn(userRecord)

        val response = controller.githubCallback("valid-code", "expected-state", requestWithStateCookie("expected-state"))
        assertEquals(HttpStatus.OK, response.status)
        val body = response.body.get()
        assertNull(body.token)
        assertEquals(id, body.userId)
        assertEquals("alice", body.username)

        val stateCookie = response.cookies.findCookie(GitHubOAuthStateService.STATE_COOKIE_NAME).orElse(null)
        assertNotNull(stateCookie, "State cookie must be cleared")
        assertEquals("", stateCookie!!.value)

        val authCookie = response.cookies.findCookie(props.cookie.cookieName).orElse(null)
        assertNotNull(authCookie, "Auth cookie must be set")
        assertTrue(authCookie!!.value.isNotBlank())
        assertEquals("alice", userSessionStore.getSession(authCookie.value)?.username)
    }

    @Test
    fun `session returns authenticated user profile`() {
        val id = UUID.nameUUIDFromBytes("u1".toByteArray())
        whenever(userRepository.findById(id))
            .thenReturn(UserRecord(id = id, username = "alice", avatarUrl = "https://avatar.url"))

        val response = controller.session(PortholePrincipal(id, "alice"))

        assertEquals(HttpStatus.OK, response.status)
        val body = response.body.get()
        assertEquals(id, body.userId)
        assertEquals("alice", body.username)
        assertNull(body.token)
    }

    @Test
    fun `session returns 401 when principal is missing`() {
        val response = controller.session(null)
        assertEquals(HttpStatus.UNAUTHORIZED, response.status)
    }

    @Test
    fun `logout clears auth cookie`() {
        val id = UUID.randomUUID()
        val token = userSessionStore.createSession(id, "alice")
        val req = SimpleHttpRequestFactory().post("/api/auth/logout", "")
            .cookie(Cookie.of(props.cookie.cookieName, token))
        val response = controller.logout(req)

        assertEquals(HttpStatus.NO_CONTENT, response.status)
        val authCookie = response.cookies.findCookie(props.cookie.cookieName).orElse(null)
        assertNotNull(authCookie, "Auth cookie must be cleared")
        assertEquals("", authCookie!!.value)
        assertNull(userSessionStore.getSession(token))
    }

    @Test
    fun `logout removes session via Authorization Bearer header`() {
        val id = UUID.randomUUID()
        val token = userSessionStore.createSession(id, "alice")
        val req = SimpleHttpRequestFactory().post("/api/auth/logout", "")
            .header(io.micronaut.http.HttpHeaders.AUTHORIZATION, "Bearer $token")
        val response = controller.logout(req)

        assertEquals(HttpStatus.NO_CONTENT, response.status)
        assertNull(userSessionStore.getSession(token))
    }

    @Test
    fun `new user with no avatar has null avatarUrl`() {
        val user = UserRecord(id = UUID.nameUUIDFromBytes("u2".toByteArray()), username = "carol", githubId = "gh-789")
        assertNull(user.avatarUrl)
    }

    private fun requestWithStateCookie(state: String): HttpRequest<*> =
        SimpleHttpRequestFactory().post("/api/auth/github/callback", "")
            .cookie(Cookie.of(GitHubOAuthStateService.STATE_COOKIE_NAME, state))
}
