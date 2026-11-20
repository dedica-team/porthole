package team.dedica.porthole.adapter.`in`.web.security

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import team.dedica.porthole.config.PortholeAuthProperties
import java.nio.charset.StandardCharsets
import java.util.UUID

class ScopedJwtServiceTest {

    private val props = PortholeAuthProperties().apply {
        jwt.secret = "test-secret-key-for-unit-tests-only-do-not-use-in-production-256bit!!"
        jwt.expirationMs = 3600000
        jwt.issuer = "porthole-test"
        jwt.audience = "porthole-test-api"
    }

    private val service = ScopedJwtService(props)

    @Test
    fun `generates valid signed JWT with scoped claims`() {
        val userId = UUID.randomUUID()
        val sessionId = UUID.randomUUID()
        val metricId = UUID.randomUUID()

        val token = service.generatePushToken(
            userId = userId,
            username = "ci-bot",
            sessionId = sessionId,
            metricId = metricId,
        )

        assertNotNull(token)
        assertTrue(token.split(".").size == 3)

        val key = Keys.hmacShaKeyFor(props.jwt.secret.toByteArray(StandardCharsets.UTF_8))
        val claims = Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .payload

        assertEquals(userId.toString(), claims.subject)
        assertEquals(userId.toString(), claims[PortholePrincipal.USER_ID_ATTRIBUTE])
        assertEquals("ci-bot", claims["username"])
        assertEquals(sessionId.toString(), claims[PortholePrincipal.SESSION_ID_ATTRIBUTE])
        assertEquals(metricId.toString(), claims[PortholePrincipal.METRIC_ID_ATTRIBUTE])
        assertEquals(PortholePrincipal.SCOPE_PUSH_METRIC, claims[PortholePrincipal.SCOPE_ATTRIBUTE])
        assertEquals("porthole-test", claims.issuer)
        assertTrue(claims.audience.contains("porthole-test-api"))
        assertNotNull(claims.expiration)
    }

    @Test
    fun `fails when username is blank`() {
        val userId = UUID.randomUUID()
        val sessionId = UUID.randomUUID()

        assertThrows(IllegalArgumentException::class.java) {
            service.generatePushToken(
                userId = userId,
                username = "   ",
                sessionId = sessionId,
            )
        }
    }
}
