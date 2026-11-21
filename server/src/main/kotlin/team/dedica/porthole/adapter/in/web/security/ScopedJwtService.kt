package team.dedica.porthole.adapter.`in`.web.security

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import io.micronaut.security.authentication.Authentication
import jakarta.inject.Singleton
import team.dedica.porthole.config.PortholeAuthProperties
import java.nio.charset.StandardCharsets
import java.util.Date
import java.util.UUID
import javax.crypto.SecretKey

@Singleton
class ScopedJwtService(props: PortholeAuthProperties) {

    private val secret: String = props.jwt.secret
    private val expirationMs: Long = props.jwt.expirationMs
    private val issuer: String = props.jwt.issuer
    private val audience: String = props.jwt.audience
    private val key: SecretKey = createSigningKey(secret)

    fun generatePushToken(
        userId: UUID,
        username: String = "ci-metric-push",
        sessionId: UUID,
        metricId: UUID? = null,
    ): String {
        require(username.isNotBlank()) { "Username must not be blank" }

        val now = Date()
        val builder = Jwts.builder()
            .subject(userId.toString())
            .issuer(issuer)
            .audience().add(audience).and()
            .claim("username", username)
            .claim(PortholePrincipal.USER_ID_ATTRIBUTE, userId.toString())
            .claim(PortholePrincipal.SESSION_ID_ATTRIBUTE, sessionId.toString())
            .claim(PortholePrincipal.SCOPE_ATTRIBUTE, PortholePrincipal.SCOPE_PUSH_METRIC)
            .id(UUID.randomUUID().toString())
            .issuedAt(now)

        if (metricId != null) {
            builder.claim(PortholePrincipal.METRIC_ID_ATTRIBUTE, metricId.toString())
        }

        if (expirationMs > 0) {
            builder.expiration(Date(now.time + expirationMs))
        }

        return builder.signWith(key).compact()
    }

    fun validateToken(token: String): Authentication? {
        return try {
            val claims = Jwts.parser()
                .verifyWith(key)
                .requireIssuer(issuer)
                .build()
                .parseSignedClaims(token)
                .payload

            val username = claims["username"]?.toString() ?: claims.subject ?: "ci-metric-push"
            val attributes = claims.entries.associate { (k, v) -> k to v }

            Authentication.build(username, listOf("USER"), attributes)
        } catch (_: Exception) {
            null
        }
    }

    private fun createSigningKey(secret: String): SecretKey {
        val normalizedSecret = secret.trim()
        require(normalizedSecret.isNotBlank()) { "JWT secret must not be blank" }

        val secretBytes = normalizedSecret.toByteArray(StandardCharsets.UTF_8)
        require(secretBytes.size >= MIN_SECRET_BYTES) {
            "JWT secret must be at least $MIN_SECRET_BYTES bytes for HS256"
        }

        return Keys.hmacShaKeyFor(secretBytes)
    }

    private companion object {
        const val MIN_SECRET_BYTES = 32
    }
}
