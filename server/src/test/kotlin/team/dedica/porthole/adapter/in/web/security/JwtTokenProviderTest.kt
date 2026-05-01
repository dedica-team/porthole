package team.dedica.porthole.adapter.`in`.web.security

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import team.dedica.porthole.config.PortholeAuthPropertiesTestFactory
import java.nio.charset.StandardCharsets
import java.util.Date
import java.util.UUID

/**
 * Unit tests for [JwtTokenProvider].
 * No Spring context needed – tests the token logic in isolation.
 */
class JwtTokenProviderTest {

    private val secret = PortholeAuthPropertiesTestFactory.DEFAULT_JWT.secret
    private val issuer = PortholeAuthPropertiesTestFactory.DEFAULT_JWT.issuer
    private val audience = PortholeAuthPropertiesTestFactory.DEFAULT_JWT.audience
    private val provider = JwtTokenProvider(PortholeAuthPropertiesTestFactory.build())
    private val id1 = UUID.randomUUID()
    private val id2 = UUID.randomUUID()

    @Test
    fun `generated token is not blank`() {
        val token = provider.generateToken(id1, "alice")
        assertTrue(token.isNotBlank())
    }

    @Test
    fun `generateToken rejects blank username`() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            provider.generateToken(id1, "   ")
        }

        assertEquals("JWT username must not be blank", error.message)
    }

    @Test
    fun `getUsernameFromToken returns the correct username`() {
        val token = provider.generateToken(id1, "alice")
        assertEquals("alice", provider.getUsernameFromToken(token))
    }

    @Test
    fun `getUserIdFromToken returns the correct user id`() {
        val token = provider.generateToken(id1, "alice")
        assertEquals(id1, provider.getUserIdFromToken(token))
    }

    @Test
    fun `validateToken returns true for a freshly issued token`() {
        val token = provider.generateToken(id1, "alice")
        assertTrue(provider.validateToken(token))
    }

    @Test
    fun `validateToken returns false for a tampered token`() {
        val token = provider.generateToken(id1, "alice")
        val tampered = token.dropLast(4) + "XXXX"
        assertFalse(provider.validateToken(tampered))
    }

    @Test
    fun `validateToken returns false for an expired token`() {
        // expirationMs = -1 → already expired when issued
        val expiredProvider = JwtTokenProvider(PortholeAuthPropertiesTestFactory.withJwt(expirationMs = -1))
        val token = expiredProvider.generateToken(id1, "alice")
        assertFalse(provider.validateToken(token))
    }

    @Test
    fun `tokens for different users are not identical`() {
        // Different subjects must always produce different tokens
        val t1 = provider.generateToken(id1, "alice")
        val t2 = provider.generateToken(id2, "bob")
        assertNotEquals(t1, t2)
    }

    @Test
    fun `validateToken returns false when issuer does not match`() {
        val token = provider.generateToken(id1, "alice")
        val otherIssuerProvider = JwtTokenProvider(PortholeAuthPropertiesTestFactory.withJwt(issuer = "other"))

        assertFalse(otherIssuerProvider.validateToken(token))
    }

    @Test
    fun `validateToken returns false when audience does not match`() {
        val token = provider.generateToken(id1, "alice")
        val otherAudienceProvider = JwtTokenProvider(PortholeAuthPropertiesTestFactory.withJwt(audience = "other-audience"))

        assertFalse(otherAudienceProvider.validateToken(token))
    }

    @Test
    fun `getTokenClaims rejects blank token`() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            provider.getTokenClaims("   ")
        }

        assertEquals("JWT token is blank", error.message)
    }

    @Test
    fun `getTokenClaims rejects token without username claim`() {
        val token = Jwts.builder()
            .subject(UUID.randomUUID().toString())
            .issuer(issuer)
            .audience().add(audience).and()
            .id(UUID.randomUUID().toString())
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + 3_600_000))
            .signWith(Keys.hmacShaKeyFor(secret.toByteArray(StandardCharsets.UTF_8)))
            .compact()

        val error = assertThrows(IllegalArgumentException::class.java) {
            provider.getTokenClaims(token)
        }

        assertEquals("JWT username claim is missing", error.message)
    }

    @Test
    fun `provider rejects too short secret`() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            JwtTokenProvider(PortholeAuthPropertiesTestFactory.withJwt(secret = "too-short-secret"))
        }

        assertEquals("JWT secret must be at least 32 bytes for HS256", error.message)
    }
}
