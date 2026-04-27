package team.dedica.porthole.adapter.`in`.web.security


import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.util.Date
import java.util.UUID
import javax.crypto.SecretKey

data class AuthTokenClaims(val userId: String, val username: String)

@Component
class JwtTokenProvider(
    @param:Value("\${porthole.jwt.secret}") private val secret: String,
    @param:Value("\${porthole.jwt.expiration-ms}") private val expirationMs: Long,
    @param:Value("\${porthole.jwt.issuer:porthole}") private val issuer: String = "porthole",
    @param:Value("\${porthole.jwt.audience:porthole-api}") private val audience: String = "porthole-api",
) {
    private val key: SecretKey = createSigningKey(secret)

    fun generateToken(userId: String, username: String): String {
        require(userId.isNotBlank()) { "JWT userId must not be blank" }
        require(username.isNotBlank()) { "JWT username must not be blank" }

        val now = Date()
        return Jwts.builder()
            .subject(userId)
            .issuer(issuer)
            .audience().add(audience).and()
            .claim("username", username)
            .id(UUID.randomUUID().toString())
            .issuedAt(now)
            .expiration(Date(now.time + expirationMs))
            .signWith(key)
            .compact()
    }

    fun getTokenClaims(token: String): AuthTokenClaims {
        val normalizedToken = token.trim()
        require(normalizedToken.isNotBlank()) { "JWT token is blank" }

        val claims = Jwts.parser().verifyWith(key).build()
            .parseSignedClaims(normalizedToken).payload
        validateRegisteredClaims(claims)

        val userId = claims.subject?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("JWT subject is missing")
        val username = (claims["username"] as? String)?.trim()?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("JWT username claim is missing")
        return AuthTokenClaims(userId = userId, username = username)
    }

    fun getUserIdFromToken(token: String): String = getTokenClaims(token).userId

    fun getUsernameFromToken(token: String): String = getTokenClaims(token).username

    fun validateToken(token: String): Boolean = runCatching {
        getTokenClaims(token)
        true
    }.getOrDefault(false)

    private fun validateRegisteredClaims(claims: Claims) {
        if (claims.issuer != issuer) throw IllegalArgumentException("JWT issuer is invalid")
        if (claims.audience?.contains(audience) != true) throw IllegalArgumentException("JWT audience is invalid")
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

