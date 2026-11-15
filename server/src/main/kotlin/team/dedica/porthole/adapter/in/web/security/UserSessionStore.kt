package team.dedica.porthole.adapter.`in`.web.security

import jakarta.inject.Singleton
import team.dedica.porthole.config.PortholeAuthProperties
import java.time.Duration
import java.time.Instant
import java.util.*
import java.util.concurrent.ConcurrentHashMap

/**
 * In-memory session store for local browser authentication mechanisms (e.g. GitHub OAuth, WebAuthn)
 * that issues opaque session identifiers without storing or using any symmetric cryptographic secrets.
 * Sessions expire after the configured cookie/session max-age.
 */
@Singleton
class UserSessionStore(
    private val props: PortholeAuthProperties? = null,
) {

    private val sessions = ConcurrentHashMap<String, UserSession>()
    private val sessionTtl: Duration get() = props?.cookie?.maxAge ?: Duration.ofDays(1)

    fun createSession(userId: UUID, username: String, ttl: Duration = sessionTtl): String {
        val sessionId = UUID.randomUUID().toString()
        val now = Instant.now()
        sessions[sessionId] = UserSession(
            userId = userId,
            username = username,
            createdAt = now,
            expiresAt = now.plus(ttl),
        )
        return sessionId
    }

    fun getSession(token: String): UserSession? {
        val session = sessions[token] ?: return null
        if (Instant.now().isAfter(session.expiresAt)) {
            sessions.remove(token)
            return null
        }
        return session
    }

    fun removeSession(token: String): UserSession? = sessions.remove(token)

    fun clear() {
        sessions.clear()
    }

    data class UserSession(
        val userId: UUID,
        val username: String,
        val createdAt: Instant = Instant.now(),
        val expiresAt: Instant = createdAt.plus(Duration.ofDays(1)),
    )
}
