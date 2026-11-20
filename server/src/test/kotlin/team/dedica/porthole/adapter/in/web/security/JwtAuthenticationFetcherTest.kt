package team.dedica.porthole.adapter.`in`.web.security

import io.micronaut.core.convert.ArgumentConversionContext
import io.micronaut.core.type.Argument
import io.micronaut.http.HttpHeaders
import io.micronaut.http.HttpRequest
import io.micronaut.http.cookie.Cookie
import io.micronaut.http.cookie.Cookies
import io.micronaut.security.authentication.Authentication
import io.micronaut.security.filters.SecurityFilter
import io.micronaut.security.token.validator.TokenValidator
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import reactor.core.publisher.Mono
import team.dedica.porthole.config.PortholeAuthProperties
import java.util.*

class JwtAuthenticationFetcherTest {

    private lateinit var authProperties: PortholeAuthProperties
    private lateinit var authCookieService: AuthCookieService
    private lateinit var userSessionStore: UserSessionStore
    private lateinit var scopedJwtService: ScopedJwtService
    private lateinit var mockTokenValidator: TokenValidator<HttpRequest<*>>
    private lateinit var fetcher: JwtAuthenticationFetcher

    @BeforeEach
    fun setUp() {
        authProperties = PortholeAuthProperties().apply {
            jwt.secret = "test-secret-key-for-unit-tests-only-do-not-use-in-production-256bit!!"
        }
        authCookieService = AuthCookieService(authProperties)
        userSessionStore = UserSessionStore()
        scopedJwtService = ScopedJwtService(authProperties)
        mockTokenValidator = mock()
        fetcher = JwtAuthenticationFetcher(listOf(mockTokenValidator), authCookieService, userSessionStore, scopedJwtService)
    }

    @Test
    fun `fetches authentication from Bearer token via scoped JWT service`() {
        val userId = UUID.randomUUID()
        val sessionId = UUID.randomUUID()
        val metricId = UUID.randomUUID()
        val token = scopedJwtService.generatePushToken(
            userId = userId,
            username = "ci-metric-push",
            sessionId = sessionId,
            metricId = metricId,
        )

        val request = mock<HttpRequest<*>>()
        val headers = mock<HttpHeaders>()
        whenever(headers.get(HttpHeaders.AUTHORIZATION)).thenReturn("Bearer $token")
        whenever(request.headers).thenReturn(headers)

        val result = Mono.from(fetcher.fetchAuthentication(request)).block()
        assertNotNull(result)
        assertEquals("ci-metric-push", result?.name)
        assertEquals(userId.toString(), result?.attributes?.get(PortholePrincipal.USER_ID_ATTRIBUTE))
        assertEquals(sessionId.toString(), result?.attributes?.get(PortholePrincipal.SESSION_ID_ATTRIBUTE))
        assertEquals(metricId.toString(), result?.attributes?.get(PortholePrincipal.METRIC_ID_ATTRIBUTE))
        assertEquals(PortholePrincipal.SCOPE_PUSH_METRIC, result?.attributes?.get(PortholePrincipal.SCOPE_ATTRIBUTE))
    }

    @Test
    fun `fetches authentication from Bearer token via asymmetric token validator`() {
        val token = "valid-asymmetric-jwt"
        val expectedAuth = Authentication.build(
            "testuser",
            listOf("USER"),
            mapOf("sub" to UUID.randomUUID().toString(), "preferred_username" to "testuser"),
        )
        whenever(mockTokenValidator.validateToken(any(), any())).doReturn(Mono.just(expectedAuth))

        val request = mock<HttpRequest<*>>()
        val headers = mock<HttpHeaders>()
        whenever(headers.get(HttpHeaders.AUTHORIZATION)).thenReturn("Bearer $token")
        whenever(request.headers).thenReturn(headers)

        val result = Mono.from(fetcher.fetchAuthentication(request)).block()
        assertNotNull(result)
        assertEquals("testuser", result?.name)
    }

    @Test
    fun `fetches authentication from auth cookie via user session store`() {
        val userId = UUID.randomUUID()
        val sessionToken = userSessionStore.createSession(userId, "cookie-user")

        val request = mock<HttpRequest<*>>()
        val headers = mock<HttpHeaders>()
        val cookies = mock<Cookies>()
        val cookie = Cookie.of("porthole_auth", sessionToken)

        whenever(headers.get(HttpHeaders.AUTHORIZATION)).thenReturn(null)
        whenever(request.headers).thenReturn(headers)
        whenever(request.cookies).thenReturn(cookies)
        whenever(cookies.findCookie("porthole_auth")).thenReturn(Optional.of(cookie))

        val result = Mono.from(fetcher.fetchAuthentication(request)).block()
        assertNotNull(result)
        assertEquals("cookie-user", result?.name)
        assertEquals(userId.toString(), result?.attributes?.get(PortholePrincipal.USER_ID_ATTRIBUTE))
    }

    @Test
    fun `returns empty when no token is present in header or cookie`() {
        val request = mock<HttpRequest<*>>()
        val headers = mock<HttpHeaders>()
        val cookies = mock<Cookies>()

        whenever(headers.get(HttpHeaders.AUTHORIZATION)).thenReturn(null)
        whenever(request.headers).thenReturn(headers)
        whenever(request.cookies).thenReturn(cookies)
        whenever(cookies.findCookie("porthole_auth")).thenReturn(Optional.empty())

        val result = Mono.from(fetcher.fetchAuthentication(request)).block()
        assertNull(result)
    }

    @Test
    fun `binder extracts PortholePrincipal from standard OIDC claims`() {
        val binder = PortholePrincipalArgumentBinder()
        val userId = UUID.randomUUID()
        val auth = Authentication.build(
            userId.toString(),
            listOf("USER"),
            mapOf(
                "sub" to userId.toString(),
                "preferred_username" to "oidc-user",
            ),
        )

        val request = mock<HttpRequest<*>>()
        whenever(request.getAttribute(SecurityFilter.AUTHENTICATION, Authentication::class.java))
            .thenReturn(Optional.of(auth))

        val context = mock<ArgumentConversionContext<PortholePrincipal>>()
        whenever(context.argument).thenReturn(Argument.of(PortholePrincipal::class.java))

        val bindingResult = binder.bind(context, request)
        assertTrue(bindingResult.isSatisfied)
        val principal = bindingResult.get()
        assertNotNull(principal)
        assertEquals(userId, principal.userId)
        assertEquals("oidc-user", principal.username)
        assertEquals(listOf("USER"), principal.roles)
    }

    @Test
    fun `binder maps OIDC sub to local UserRecord id via findByKeycloakId`() {
        val localUserId = UUID.randomUUID()
        val keycloakSub = "kc-subject-12345"
        val mockUserRepo = mock<team.dedica.porthole.application.port.UserPort>()
        whenever(mockUserRepo.findByKeycloakId(keycloakSub)).thenReturn(
            team.dedica.porthole.adapter.out.repository.UserRecord(
                id = localUserId,
                username = "local-alice",
                keycloakId = keycloakSub,
            )
        )

        val binder = PortholePrincipalArgumentBinder(mockUserRepo)
        val auth = Authentication.build(
            keycloakSub,
            listOf("USER"),
            mapOf("sub" to keycloakSub, "preferred_username" to "ignored-remote-username"),
        )

        val request = mock<HttpRequest<*>>()
        whenever(request.getAttribute(SecurityFilter.AUTHENTICATION, Authentication::class.java))
            .thenReturn(Optional.of(auth))

        val context = mock<ArgumentConversionContext<PortholePrincipal>>()
        whenever(context.argument).thenReturn(Argument.of(PortholePrincipal::class.java))

        val bindingResult = binder.bind(context, request)
        assertTrue(bindingResult.isSatisfied)
        val principal = bindingResult.get()
        assertNotNull(principal)
        assertEquals(localUserId, principal.userId)
        assertEquals("local-alice", principal.username)
    }
}
