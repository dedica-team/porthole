package team.dedica.porthole.adapter.`in`.web.security

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.nio.charset.StandardCharsets
import java.util.Date
import java.util.UUID

/**
 * Unit tests for [JwtTokenProvider].
 * No Spring context needed – tests the token logic in isolation.
 */
class JwtTokenProviderTest {

    private val secret = "landmarks-super-secret-key-change-in-production-must-be-256-bits!!"
    private val provider = JwtTokenProvider(
        secret = secret,
        expirationMs = 3_600_000,
        issuer = "porthole-test",
        audience = "porthole-test-api",
    )

    @Test
    fun `generated token is not blank`() {
        val token = provider.generateToken("u1", "alice")
        assertTrue(token.isNotBlank())
    }

    @Test
    fun `generateToken rejects blank user id`() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            provider.generateToken("   ", "alice")
        }

        assertEquals("JWT userId must not be blank", error.message)
    }

    @Test
    fun `generateToken rejects blank username`() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            provider.generateToken("u1", "   ")
        }

        assertEquals("JWT username must not be blank", error.message)
    }

    @Test
    fun `getUsernameFromToken returns the correct username`() {
        val token = provider.generateToken("u1", "alice")
        assertEquals("alice", provider.getUsernameFromToken(token))
    }

    @Test
    fun `getUserIdFromToken returns the correct user id`() {
        val token = provider.generateToken("u1", "alice")
        assertEquals("u1", provider.getUserIdFromToken(token))
    }

    @Test
    fun `validateToken returns true for a freshly issued token`() {
        val token = provider.generateToken("u1", "alice")
        assertTrue(provider.validateToken(token))
    }

    @Test
    fun `validateToken returns false for a tampered token`() {
        val token = provider.generateToken("u1", "alice")
        val tampered = token.dropLast(4) + "XXXX"
        assertFalse(provider.validateToken(tampered))
    }

    @Test
    fun `validateToken returns false for an expired token`() {
        // expirationMs = -1 → already expired when issued
        val expiredProvider = JwtTokenProvider(secret = secret, expirationMs = -1, issuer = "porthole-test", audience = "porthole-test-api")
        val token = expiredProvider.generateToken("u1", "alice")
        assertFalse(provider.validateToken(token))
    }

    @Test
    fun `tokens for different users are not identical`() {
        // Different subjects must always produce different tokens
        val t1 = provider.generateToken("u1", "alice")
        val t2 = provider.generateToken("u2", "bob")
        assertNotEquals(t1, t2)
    }

    @Test
    fun `validateToken returns false when issuer does not match`() {
        val token = provider.generateToken("u1", "alice")
        val otherIssuerProvider = JwtTokenProvider(secret = secret, expirationMs = 3_600_000, issuer = "other", audience = "porthole-test-api")

        assertFalse(otherIssuerProvider.validateToken(token))
    }

    @Test
    fun `validateToken returns false when audience does not match`() {
        val token = provider.generateToken("u1", "alice")
        val otherAudienceProvider = JwtTokenProvider(secret = secret, expirationMs = 3_600_000, issuer = "porthole-test", audience = "other-audience")

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
            .subject("u1")
            .issuer("porthole-test")
            .audience().add("porthole-test-api").and()
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
            JwtTokenProvider(secret = "too-short-secret", expirationMs = 3_600_000, issuer = "porthole-test", audience = "porthole-test-api")
        }

        assertEquals("JWT secret must be at least 32 bytes for HS256", error.message)
    }
}

