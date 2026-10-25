package team.dedica.porthole.adapter.`in`.web.security

import jakarta.inject.Singleton
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.*

@Singleton
class GitHubOAuthStateService {
    private val secureRandom = SecureRandom()

    fun issueState(): String {
        val bytes = ByteArray(32)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun isValidCallbackState(expectedState: String?, providedState: String?): Boolean {
        if (expectedState.isNullOrBlank() || providedState.isNullOrBlank()) return false
        return MessageDigest.isEqual(
            expectedState.toByteArray(Charsets.UTF_8),
            providedState.toByteArray(Charsets.UTF_8),
        )
    }

    companion object {
        const val STATE_COOKIE_NAME = "porthole_github_oauth_state"
        const val STATE_COOKIE_PATH = "/api/auth/github/callback"
        const val STATE_TTL_SECONDS = 600L
    }
}

