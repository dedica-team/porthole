package team.dedica.porthole.adapter.`in`.web.security
import java.util.UUID

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.ResponseCookie
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.authentication.TestingAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.core.oidc.OidcIdToken
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser
import org.springframework.security.oauth2.core.user.OAuth2User
import team.dedica.porthole.adapter.`in`.web.KeycloakOAuthService
import team.dedica.porthole.adapter.out.repository.UserRecord
import java.time.Instant

class KeycloakLoginSuccessHandlerTest {

    private val keycloakOAuthService = mock<KeycloakOAuthService>()
    private val jwtTokenProvider = mock<JwtTokenProvider>()
    private val authCookieService = mock<AuthCookieService>()

    private val callbackUrl = "https://app.example.com/auth/keycloak/callback"

    private val handler = KeycloakLoginSuccessHandler(
        keycloakOAuthService = keycloakOAuthService,
        jwtTokenProvider = jwtTokenProvider,
        authCookieService = authCookieService,
        frontendCallbackUrl = callbackUrl,
    )

    @Test
    fun `onAuthenticationSuccess sets auth cookie and redirects for valid OIDC principal`() {
        val oidcUser = oidcUser(
            sub = "kc-123",
            preferredUsername = "Alice.Example",
            email = "alice@example.com",
            picture = "https://example.com/avatar.png",
        )
        val userRecord = UserRecord(id = UUID.nameUUIDFromBytes("u-1".toByteArray()), username = "alice-example", keycloakId = "kc-123")
        whenever(keycloakOAuthService.upsertUser(any())).thenReturn(userRecord)
        whenever(jwtTokenProvider.generateToken(UUID.nameUUIDFromBytes("u-1".toByteArray()), "alice-example")).thenReturn("jwt-token")
        whenever(authCookieService.createAuthCookie("jwt-token")).thenReturn(
            ResponseCookie.from("porthole_auth", "jwt-token").httpOnly(true).path("/").build()
        )

        val request = MockHttpServletRequest()
        val response = MockHttpServletResponse()
        handler.onAuthenticationSuccess(request, response, TestingAuthenticationToken(oidcUser, null))

        verify(keycloakOAuthService).upsertUser(any())
        verify(jwtTokenProvider).generateToken(UUID.nameUUIDFromBytes("u-1".toByteArray()), "alice-example")
        verify(authCookieService).createAuthCookie("jwt-token")

        assertEquals(302, response.status)
        assertEquals(callbackUrl, response.redirectedUrl)
        assertTrue(response.getHeaders("Set-Cookie").any { it.contains("porthole_auth=jwt-token") })
    }

    @Test
    fun `onAuthenticationSuccess returns 401 when sub claim is missing`() {
        val oauth2User = object : OAuth2User {
            override fun getName(): String = "alice"
            override fun getAuthorities() = listOf(SimpleGrantedAuthority("ROLE_USER"))
            override fun getAttributes(): Map<String, Any> = mapOf("preferred_username" to "alice")
        }

        val request = MockHttpServletRequest()
        val response = MockHttpServletResponse()
        handler.onAuthenticationSuccess(request, response, TestingAuthenticationToken(oauth2User, null))

        assertEquals(401, response.status)
        verify(keycloakOAuthService, never()).upsertUser(any())
        verify(jwtTokenProvider, never()).generateToken(any(), any())
        verify(authCookieService, never()).createAuthCookie(any())
    }

    private fun oidcUser(
        sub: String,
        preferredUsername: String,
        email: String,
        picture: String,
    ): DefaultOidcUser {
        val now = Instant.now()
        val idToken = OidcIdToken(
            "id-token",
            now,
            now.plusSeconds(300),
            mapOf(
                "sub" to sub,
                "preferred_username" to preferredUsername,
                "email" to email,
                "picture" to picture,
            ),
        )
        return DefaultOidcUser(listOf(SimpleGrantedAuthority("ROLE_USER")), idToken)
    }
}

