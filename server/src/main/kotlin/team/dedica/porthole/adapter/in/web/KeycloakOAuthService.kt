package team.dedica.porthole.adapter.`in`.web

import jakarta.inject.Singleton
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.UserPort
import java.util.UUID

data class KeycloakUserInfo(
    val keycloakId: String,
    val username: String,
    val email: String?,
    val avatarUrl: String?,
)

/**
 * Handles Keycloak user persistence.
 * HTTP interaction (authorization code flow, token exchange, userinfo) is now
 * delegated to Spring Security OAuth2 Client — see [KeycloakLoginSuccessHandler].
 */
@Singleton
class KeycloakOAuthService(
    private val userRepository: UserPort,
) {
    /**
     * Looks up or creates a [UserRecord] based on the given [KeycloakUserInfo].
     */
    fun upsertUser(info: KeycloakUserInfo): UserRecord =
        userRepository.findByKeycloakId(info.keycloakId)?.let { existing ->
            val updated = existing.copy(
                email = info.email ?: existing.email,
                avatarUrl = info.avatarUrl ?: existing.avatarUrl,
            )
            userRepository.save(updated)
            updated
        } ?: run {
            val baseUsername = info.username.lowercase().replace(Regex("[^a-z0-9_-]"), "-")
                .ifBlank { "user" }
            var candidate = baseUsername
            var suffix = 1
            while (userRepository.findByUsername(candidate) != null) {
                candidate = "$baseUsername-$suffix"
                suffix++
            }
            val newUser = UserRecord(
                id = UUID.randomUUID(),
                username = candidate,
                keycloakId = info.keycloakId,
                email = info.email,
                avatarUrl = info.avatarUrl,
            )
            userRepository.save(newUser)
            newUser
        }
}
