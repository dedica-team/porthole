package team.dedica.porthole.adapter.`in`.web

import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.util.UriComponentsBuilder
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.config.PortholeAuthProperties
import java.util.UUID

data class GitHubUserInfo(
    val githubId: String,
    val login: String,
    val avatarUrl: String?,
    val email: String?,
)

/**
 * Encapsulates all GitHub OAuth API interactions.
 * Keeps [OAuthController] thin and allows this logic to be tested independently.
 */
@Service
class GitHubOAuthService(
    private val userRepository: UserPort,
    props: PortholeAuthProperties,
) {
    private val clientId = props.github.clientId
    private val clientSecret = props.github.clientSecret
    // RestTemplate is intentionally not a shared Bean here – OAuth calls are infrequent
    // and do not benefit from connection pooling. Replace with WebClient if async is needed.
    private val restTemplate = RestTemplate()

    fun buildAuthorizationUrl(state: String, redirectUri: String): String =
        UriComponentsBuilder.fromUriString("https://github.com/login/oauth/authorize")
            .queryParam("client_id", clientId)
            .queryParam("redirect_uri", redirectUri)
            .queryParam("scope", "read:user,user:email")
            .queryParam("state", state)
            .build(true)
            .toUriString()

    /** Exchanges the OAuth authorization code for a GitHub access token. */
    fun exchangeCodeForToken(code: String, redirectUri: String): String? {
        val headers = HttpHeaders().apply {
            accept = listOf(MediaType.APPLICATION_JSON)
            contentType = MediaType.APPLICATION_FORM_URLENCODED
        }
        val body = LinkedMultiValueMap<String, String>().apply {
            add("client_id", clientId)
            add("client_secret", clientSecret)
            add("code", code)
            add("redirect_uri", redirectUri)
        }
        val response = runCatching {
            restTemplate.exchange(
                "https://github.com/login/oauth/access_token",
                HttpMethod.POST,
                HttpEntity(body, headers),
                Map::class.java,
            )
        }.getOrNull() ?: return null

        @Suppress("UNCHECKED_CAST")
        return (response.body as? Map<String, Any>)?.get("access_token") as? String
    }

    /** Fetches basic user info (id, login, avatar_url) from the GitHub API. */
    fun fetchUserInfo(accessToken: String): GitHubUserInfo? {
        val headers = HttpHeaders().apply {
            setBearerAuth(accessToken)
            accept = listOf(MediaType.APPLICATION_JSON)
        }
        val response = runCatching {
            restTemplate.exchange(
                "https://api.github.com/user",
                HttpMethod.GET,
                HttpEntity<Unit>(headers),
                Map::class.java,
            )
        }.getOrNull() ?: return null

        @Suppress("UNCHECKED_CAST")
        val body = response.body as? Map<String, Any> ?: return null
        val githubId = body["id"]?.toString() ?: return null
        val login = body["login"] as? String ?: return null
        val avatarUrl = body["avatar_url"] as? String
        val email = fetchPrimaryEmail(accessToken)
        return GitHubUserInfo(githubId = githubId, login = login, avatarUrl = avatarUrl, email = email)
    }

    /** Fetches the verified primary email address from the GitHub API. */
    private fun fetchPrimaryEmail(accessToken: String): String? {
        val headers = HttpHeaders().apply {
            setBearerAuth(accessToken)
            accept = listOf(MediaType.APPLICATION_JSON)
        }
        val response = runCatching {
            restTemplate.exchange(
                "https://api.github.com/user/emails",
                HttpMethod.GET,
                HttpEntity<Unit>(headers),
                List::class.java,
            )
        }.getOrNull() ?: return null

        @Suppress("UNCHECKED_CAST")
        val emails = response.body as? List<Map<String, Any>> ?: return null
        return emails
            .firstOrNull { it["primary"] == true && it["verified"] == true }
            ?.get("email") as? String
    }

    /**
     * Looks up or creates a [UserRecord] based on the given [GitHubUserInfo].
     * If the user already exists (by githubId), email and avatar are updated.
     * Username is lowercased for consistency with WebAuthn registration.
     */
    fun upsertUser(info: GitHubUserInfo): UserRecord =
        userRepository.findByGithubId(info.githubId)?.let { existing ->
            val updated = existing.copy(
                email = info.email ?: existing.email,
                avatarUrl = info.avatarUrl ?: existing.avatarUrl,
            )
            userRepository.save(updated)
            updated
        } ?: run {
            val baseUsername = info.login.lowercase()
            // Ensure the GitHub login doesn't collide with an existing username
            var candidate = baseUsername
            var suffix = 1
            while (userRepository.findByUsername(candidate) != null) {
                candidate = "$baseUsername-$suffix"
                suffix++
            }
            val newUser = UserRecord(
                id = UUID.randomUUID(),
                username = candidate,
                githubId = info.githubId,
                email = info.email,
                avatarUrl = info.avatarUrl,
            )
            userRepository.save(newUser)
            newUser
        }
}

