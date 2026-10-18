package team.dedica.porthole.adapter.`in`.web

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.inject.Singleton
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.config.PortholeAuthProperties
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
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
 *
 * Uses the JDK [HttpClient] directly: GitHub OAuth calls are infrequent and do not
 * benefit from Micronaut's load-balanced client, which is designed for service discovery.
 */
@Singleton
class GitHubOAuthService(
    private val userRepository: UserPort,
    private val objectMapper: ObjectMapper,
    props: PortholeAuthProperties,
) {
    private val clientId = props.github.clientId
    private val clientSecret = props.github.clientSecret
    private val httpClient: HttpClient = HttpClient.newHttpClient()

    fun buildAuthorizationUrl(state: String, redirectUri: String): String =
        "https://github.com/login/oauth/authorize?" + formEncode(
            mapOf(
                "client_id" to clientId,
                "redirect_uri" to redirectUri,
                "scope" to "read:user,user:email",
                "state" to state,
            ),
        )

    /** Exchanges the OAuth authorization code for a GitHub access token. */
    fun exchangeCodeForToken(code: String, redirectUri: String): String? {
        val body = formEncode(
            mapOf(
                "client_id" to clientId,
                "client_secret" to clientSecret,
                "code" to code,
                "redirect_uri" to redirectUri,
            ),
        )
        val request = HttpRequest.newBuilder(URI.create("https://github.com/login/oauth/access_token"))
            .header("Accept", "application/json")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build()

        val response = send(request) ?: return null
        return response["access_token"] as? String
    }

    /** Fetches basic user info (id, login, avatar_url) from the GitHub API. */
    fun fetchUserInfo(accessToken: String): GitHubUserInfo? {
        val body = get("https://api.github.com/user", accessToken) ?: return null
        val githubId = body["id"]?.toString() ?: return null
        val login = body["login"] as? String ?: return null
        val avatarUrl = body["avatar_url"] as? String
        val email = fetchPrimaryEmail(accessToken)
        return GitHubUserInfo(githubId = githubId, login = login, avatarUrl = avatarUrl, email = email)
    }

    /** Fetches the verified primary email address from the GitHub API. */
    private fun fetchPrimaryEmail(accessToken: String): String? {
        val raw = rawRequest("https://api.github.com/user/emails", accessToken) ?: return null
        @Suppress("UNCHECKED_CAST")
        val emails = runCatching { objectMapper.readValue(raw, List::class.java) as? List<Map<String, Any>> }
            .getOrNull() ?: return null
        return emails
            .firstOrNull { it["primary"] == true && it["verified"] == true }
            ?.get("email") as? String
    }

    private fun get(url: String, accessToken: String): Map<String, Any>? {
        val raw = rawRequest(url, accessToken) ?: return null
        @Suppress("UNCHECKED_CAST")
        return runCatching { objectMapper.readValue(raw, Map::class.java) as? Map<String, Any> }
            .getOrNull()
    }

    private fun rawRequest(url: String, accessToken: String): String? {
        val request = HttpRequest.newBuilder(URI.create(url))
            .header("Accept", "application/json")
            .header("Authorization", "Bearer $accessToken")
            .header("User-Agent", "porthole")
            .GET()
            .build()
        return sendString(request)
    }

    private fun send(request: HttpRequest): Map<String, Any>? {
        val raw = sendString(request) ?: return null
        @Suppress("UNCHECKED_CAST")
        return runCatching { objectMapper.readValue(raw, Map::class.java) as? Map<String, Any> }
            .getOrNull()
    }

    private fun sendString(request: HttpRequest): String? = runCatching {
        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) null else response.body()
    }.getOrNull()

    private fun formEncode(params: Map<String, String>): String =
        params.entries.joinToString("&") { (key, value) ->
            "${URLEncoder.encode(key, StandardCharsets.UTF_8)}=${URLEncoder.encode(value, StandardCharsets.UTF_8)}"
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
