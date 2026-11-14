package team.dedica.porthole.adapter.`in`.web.security

import jakarta.inject.Singleton
import java.time.Instant
import java.util.*
import java.util.concurrent.ConcurrentHashMap

/**
 * In-memory session store for local browser authentication mechanisms (e.g. GitHub OAuth, WebAuthn)
 * that issues opaque session identifiers without storing or using any symmetric cryptographic secrets.
 */
@Singleton
class UserSessionStore {

    private val sessions = ConcurrentHashMap<String, UserSession>()

    fun createSession(userId: UUID, username: String): String {
        val sessionId = UUID.randomUUID().toString()
        sessions[sessionId] = UserSession(userId = userId, username = username, createdAt = Instant.now())
        return sessionId
    }

    fun getSession(token: String): UserSession? = sessions[token]

    fun removeSession(token: String): UserSession? = sessions.remove(token)

    fun clear() {
        sessions.clear()
    }

    data class UserSession(
        val userId: UUID,
        val username: String,
        val createdAt: Instant = Instant.now(),
    )
}
