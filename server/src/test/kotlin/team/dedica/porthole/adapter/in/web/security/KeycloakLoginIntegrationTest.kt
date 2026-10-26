package team.dedica.porthole.adapter.`in`.web.security

import dasniko.testcontainers.keycloak.KeycloakContainer
import io.micronaut.runtime.server.EmbeddedServer
import io.micronaut.test.extensions.junit5.annotation.MicronautTest
import io.micronaut.test.support.TestPropertyProvider
import jakarta.inject.Inject
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.condition.EnabledIf
import org.testcontainers.DockerClientFactory
import team.dedica.porthole.application.port.UserPort
import java.net.CookieManager
import java.net.CookiePolicy
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.util.regex.Pattern

/**
 * End-to-end integration test for the Keycloak authentication flow.
 *
 * Uses Testcontainers to spin up a Keycloak instance configured with the Porthole realm,
 * executes the full OAuth2 authorization code flow via Micronaut Security, and verifies
 * that a valid Porthole session is established.
 *
 * Automatically skipped when Docker is not available (e.g., in CI environments without Docker support).
 */
@MicronautTest
@EnabledIf("isDockerAvailable")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class KeycloakLoginIntegrationTest : TestPropertyProvider {

    @Inject
    lateinit var server: EmbeddedServer

    @Inject
    lateinit var userPort: UserPort

    companion object {
        @JvmStatic
        fun isDockerAvailable(): Boolean = try {
            DockerClientFactory.instance().isDockerAvailable
        } catch (e: Throwable) {
            false
        }

        private val keycloak: KeycloakContainer? by lazy {
            if (isDockerAvailable()) {
                KeycloakContainer("quay.io/keycloak/keycloak:26.1.3")
                    .withRealmImportFile("keycloak/porthole-realm.json")
                    .apply { start() }
            } else {
                null
            }
        }
    }

    override fun getProperties(): Map<String, String> {
        val kc = keycloak ?: return emptyMap()
        val issuerUri = "${kc.authServerUrl.trimEnd('/')}/realms/porthole"
        return mapOf(
            "porthole.auth.keycloak.client-id" to "porthole-client",
            "porthole.auth.keycloak.client-secret" to "porthole-secret",
            "porthole.auth.keycloak.issuer-uri" to issuerUri,
            "porthole.auth.keycloak.redirect-uri" to "http://localhost:5173/auth/keycloak/callback",
            "micronaut.security.oauth2.clients.keycloak.client-id" to "porthole-client",
            "micronaut.security.oauth2.clients.keycloak.client-secret" to "porthole-secret",
            "micronaut.security.oauth2.clients.keycloak.openid.issuer" to issuerUri,
        )
    }

    @Test
    fun `auth config reports keycloak enabled`() {
        val client = HttpClient.newHttpClient()
        val request = HttpRequest.newBuilder(URI.create("http://localhost:${server.port}/api/auth/config"))
            .GET()
            .build()
        val response = client.send(request, HttpResponse.BodyHandlers.ofString())

        assertEquals(200, response.statusCode())
        assertTrue(
            response.body().contains("\"keycloakEnabled\":true"),
            "Expected keycloakEnabled to be true in config response: ${response.body()}"
        )
    }

    @Test
    fun `full keycloak oauth login flow authenticates user and creates session`() {
        val cookieManager = CookieManager().apply {
            setCookiePolicy(CookiePolicy.ACCEPT_ALL)
        }
        val http = HttpClient.newBuilder()
            .cookieHandler(cookieManager)
            .followRedirects(HttpClient.Redirect.NEVER)
            .build()

        val baseUrl = "http://localhost:${server.port}"

        // Step 1: Initiate OAuth2 login with Keycloak provider on Micronaut server
        val authStartRequest = HttpRequest.newBuilder(URI.create("$baseUrl/oauth2/authorization/keycloak"))
            .GET()
            .build()
        val authStartResponse = http.send(authStartRequest, HttpResponse.BodyHandlers.ofString())

        assertTrue(
            authStartResponse.statusCode() in listOf(302, 303, 307),
            "Expected redirect to Keycloak authorization endpoint, got ${authStartResponse.statusCode()}"
        )
        val keycloakAuthUrl = authStartResponse.headers().firstValue("Location")
            .orElseThrow { AssertionError("Missing Location header in authorization redirect") }

        assertTrue(
            keycloakAuthUrl.contains("/realms/porthole/protocol/openid-connect/auth"),
            "Expected Location to point to Keycloak auth endpoint, got $keycloakAuthUrl"
        )

        // Step 2: Request the Keycloak login page
        val loginPageRequest = HttpRequest.newBuilder(URI.create(keycloakAuthUrl))
            .GET()
            .build()
        val loginPageResponse = http.send(loginPageRequest, HttpResponse.BodyHandlers.ofString())
        assertEquals(200, loginPageResponse.statusCode(), "Keycloak login page should return 200 OK")

        // Extract form action URL from Keycloak login HTML
        val formAction = extractFormAction(loginPageResponse.body(), keycloakAuthUrl)

        // Step 3: Submit login credentials to Keycloak
        val formBody = listOf(
            "username" to "testuser",
            "password" to "testpass"
        ).joinToString("&") { (k, v) ->
            URLEncoder.encode(k, StandardCharsets.UTF_8) + "=" + URLEncoder.encode(v, StandardCharsets.UTF_8)
        }

        val keycloakCookies = loginPageResponse.headers().allValues("Set-Cookie")
            .map { it.substringBefore(";") }
            .joinToString("; ")

        val loginSubmitRequestBuilder = HttpRequest.newBuilder(URI.create(formAction))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(formBody))
        if (keycloakCookies.isNotBlank()) {
            loginSubmitRequestBuilder.header("Cookie", keycloakCookies)
        }
        val loginSubmitRequest = loginSubmitRequestBuilder.build()
        val loginSubmitResponse = http.send(loginSubmitRequest, HttpResponse.BodyHandlers.ofString())

        assertTrue(
            loginSubmitResponse.statusCode() in listOf(302, 303),
            "Expected redirect back to Micronaut callback, got status ${loginSubmitResponse.statusCode()} with body: ${loginSubmitResponse.body()}"
        )
        val callbackUrl = loginSubmitResponse.headers().firstValue("Location")
            .orElseThrow { AssertionError("Missing Location header after Keycloak login submission") }

        assertTrue(
            callbackUrl.contains("/login/oauth2/code/keycloak"),
            "Expected callback URL to be Micronaut OAuth2 callback, got $callbackUrl"
        )

        // Step 4: Follow the callback back to Micronaut server
        val callbackRequest = HttpRequest.newBuilder(URI.create(callbackUrl))
            .GET()
            .build()
        val callbackResponse = http.send(callbackRequest, HttpResponse.BodyHandlers.ofString())

        assertTrue(
            callbackResponse.statusCode() in listOf(302, 303),
            "Expected redirect to frontend callback, got ${callbackResponse.statusCode()}"
        )
        val frontendLocation = callbackResponse.headers().firstValue("Location")
            .orElseThrow { AssertionError("Missing Location header from Micronaut callback") }
        assertEquals("http://localhost:5173/auth/keycloak/callback", frontendLocation)

        // Step 5: Check that the porthole_auth session cookie was set
        val setCookieHeaders = callbackResponse.headers().allValues("Set-Cookie")
        val authCookieHeader = setCookieHeaders.firstOrNull { it.startsWith("porthole_auth=") }
        assertNotNull(authCookieHeader, "Expected porthole_auth Set-Cookie header in $setCookieHeaders")

        val authCookieValue = authCookieHeader!!.substringBefore(";").substringAfter("porthole_auth=")
        assertTrue(authCookieValue.isNotBlank(), "porthole_auth cookie value should not be blank")

        // Step 6: Validate session with the issued cookie
        val sessionRequest = HttpRequest.newBuilder(URI.create("$baseUrl/api/auth/session"))
            .header("Cookie", "porthole_auth=$authCookieValue")
            .GET()
            .build()
        val sessionResponse = http.send(sessionRequest, HttpResponse.BodyHandlers.ofString())

        assertEquals(200, sessionResponse.statusCode())
        val sessionBody = sessionResponse.body()
        assertTrue(sessionBody.contains("\"username\":\"testuser\""), "Session should contain username 'testuser': $sessionBody")
        assertTrue(sessionBody.contains("\"keycloakEnabled\":true"), "Session should indicate keycloak is enabled: $sessionBody")

        // Step 7: Verify user record in repository
        val userRecord = userPort.findByUsername("testuser")
        assertNotNull(userRecord, "User 'testuser' should be persisted in user repository")
        assertNotNull(userRecord!!.keycloakId, "User record should have a keycloakId")
        assertEquals("testuser@example.com", userRecord.email)
    }

    private fun extractFormAction(html: String, pageUrl: String): String {
        val pattern = Pattern.compile("(?i)<form\\b[^>]*\\baction=[\"']([^\"']+)[\"']", Pattern.DOTALL)
        val matcher = pattern.matcher(html)
        if (matcher.find()) {
            val rawAction = matcher.group(1).replace("&amp;", "&")
            return URI.create(pageUrl).resolve(rawAction).toString()
        }
        throw IllegalStateException("Could not find login form action in Keycloak HTML response: $html")
    }
}
