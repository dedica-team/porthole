package team.dedica.porthole.adapter.`in`.web

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import org.springframework.mock.web.MockCookie
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.security.core.userdetails.User
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.adapter.`in`.web.security.AuthCookieService
import team.dedica.porthole.adapter.`in`.web.security.GitHubOAuthStateService
import team.dedica.porthole.adapter.`in`.web.security.JwtTokenProvider

class GitHubOAuthControllerTest {

    private val gitHubOAuthService = mock<GitHubOAuthService>()
    private val jwtTokenProvider = mock<JwtTokenProvider>()
    private val userRepository = mock<UserWritePort>()
    private val gitHubOAuthStateService = GitHubOAuthStateService()
    private val authCookieService = AuthCookieService(expirationMs = 3_600_000L)
    private val adminService = AdminService("")
    private lateinit var controller: GitHubOAuthController

    @BeforeEach
    fun setUp() {
        controller = GitHubOAuthController(
            gitHubOAuthService,
            gitHubOAuthStateService,
            jwtTokenProvider,
            authCookieService,
            userRepository,
            adminService,
            "test-client-id",
            "http://localhost:5173/auth/github/callback",
        )
        whenever(jwtTokenProvider.generateToken(any(), any())).thenAnswer { "token-${it.arguments[1]}" }
    }

    @Test
    fun `existing user by githubId gets a JWT`() {
        whenever(jwtTokenProvider.generateToken("u1", "alice")).thenReturn("token-alice")

        val token = jwtTokenProvider.generateToken("u1", "alice")
        assertEquals("token-alice", token)
        verify(jwtTokenProvider).generateToken("u1", "alice")
    }

    @Test
    fun `githubStart returns authorization url and state cookie`() {
        whenever(gitHubOAuthService.buildAuthorizationUrl(any(), any())).thenReturn("https://github.com/login/oauth/authorize?state=s")

        val response = controller.githubStart()

        assertEquals(200, response.statusCode.value())
        assertEquals("https://github.com/login/oauth/authorize?state=s", response.body?.authorizationUrl)
        assertTrue(response.headers.getFirst("Set-Cookie")?.contains(GitHubOAuthStateService.STATE_COOKIE_NAME) == true)
        verify(gitHubOAuthService).buildAuthorizationUrl(any(), eq("http://localhost:5173/auth/github/callback"))
    }

    @Test
    fun `githubCallback returns 401 when token exchange fails`() {
        whenever(gitHubOAuthService.exchangeCodeForToken(any(), any())).thenReturn(null)
        val response = controller.githubCallback("bad-code", "expected-state", requestWithStateCookie("expected-state"))
        assertEquals(401, response.statusCode.value())
    }

    @Test
    fun `githubCallback returns 401 when user info fetch fails`() {
        whenever(gitHubOAuthService.exchangeCodeForToken(any(), any())).thenReturn("valid-token")
        whenever(gitHubOAuthService.fetchUserInfo(any())).thenReturn(null)
        val response = controller.githubCallback("some-code", "expected-state", requestWithStateCookie("expected-state"))
        assertEquals(401, response.statusCode.value())
    }

    @Test
    fun `githubCallback returns 401 when oauth state is invalid`() {
        val response = controller.githubCallback("valid-code", "wrong-state", requestWithStateCookie("expected-state"))

        assertEquals(401, response.statusCode.value())
        verify(gitHubOAuthService, never()).exchangeCodeForToken(any(), any())
    }

    @Test
    fun `githubCallback returns auth response for valid code`() {
        val userInfo = GitHubUserInfo("gh-1", "alice", "https://avatar.url", "alice@x.com")
        val userRecord = UserRecord(id = "u1", username = "alice", githubId = "gh-1", avatarUrl = "https://avatar.url")
        whenever(gitHubOAuthService.exchangeCodeForToken("valid-code", "http://localhost:5173/auth/github/callback")).thenReturn("gh-access")
        whenever(gitHubOAuthService.fetchUserInfo("gh-access")).thenReturn(userInfo)
        whenever(gitHubOAuthService.upsertUser(userInfo)).thenReturn(userRecord)
        whenever(jwtTokenProvider.generateToken("u1", "alice")).thenReturn("jwt-alice")

        val response = controller.githubCallback("valid-code", "expected-state", requestWithStateCookie("expected-state"))
        assertEquals(200, response.statusCode.value())
        val body = response.body!!
        assertNull(body.token)
        assertEquals("u1", body.userId)
        assertEquals("alice", body.username)
        assertTrue(response.headers.getFirst("Set-Cookie")?.contains("Max-Age=0") == true)
        assertTrue(response.headers["Set-Cookie"]?.any { it.contains("porthole_auth=") } == true)
    }

    @Test
    fun `session returns authenticated user profile`() {
        whenever(userRepository.findByUsername("alice"))
            .thenReturn(UserRecord(id = "u1", username = "alice", avatarUrl = "https://avatar.url"))

        val response = controller.session(User("alice", "", emptyList()))

        assertEquals(200, response.statusCode.value())
        assertEquals("u1", response.body?.userId)
        assertEquals("alice", response.body?.username)
        assertNull(response.body?.token)
    }

    @Test
    fun `logout clears auth cookie`() {
        val response = controller.logout()

        assertEquals(204, response.statusCode.value())
        assertTrue(response.headers.getFirst("Set-Cookie")?.contains("Max-Age=0") == true)
        assertTrue(response.headers.getFirst("Set-Cookie")?.contains("porthole_auth=") == true)
    }

    @Test
    fun `new user with no avatar has null avatarUrl`() {
        val user = UserRecord(id = "u2", username = "carol", githubId = "gh-789")
        assertNull(user.avatarUrl)
    }

    private fun requestWithStateCookie(state: String): MockHttpServletRequest =
        MockHttpServletRequest().apply {
            setCookies(MockCookie(GitHubOAuthStateService.STATE_COOKIE_NAME, state))
        }
}
