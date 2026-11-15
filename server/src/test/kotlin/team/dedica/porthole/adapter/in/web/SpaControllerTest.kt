package team.dedica.porthole.adapter.`in`.web

import io.micronaut.runtime.server.EmbeddedServer
import io.micronaut.test.extensions.junit5.annotation.MicronautTest
import jakarta.inject.Inject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.`in`.web.security.AuthCookieService
import team.dedica.porthole.adapter.`in`.web.security.UserSessionStore
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

/**
 * Integration tests for the SPA fallback. Boots the real application on an embedded
 * server (using the `static/index.html` and `static/assets/app.js` test resources) and
 * verifies that client-side routes are served the SPA entry point while API, WebSocket
 * and asset paths keep their normal behaviour.
 */
@MicronautTest
class SpaControllerTest {

    @Inject
    lateinit var server: EmbeddedServer

    @Inject
    lateinit var userSessionStore: UserSessionStore

    @Inject
    lateinit var authCookieService: AuthCookieService

    private val http: HttpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .build()

    private fun get(path: String, authCookie: String? = null): HttpResponse<String> {
        val builder = HttpRequest.newBuilder(URI.create("http://localhost:${server.port}$path"))
        authCookie?.let { builder.header("Cookie", it) }
        return http.send(builder.GET().build(), HttpResponse.BodyHandlers.ofString())
    }

    private fun authCookieHeader(): String {
        val token = userSessionStore.createSession(UUID.randomUUID(), "spa-tester")
        val cookie = authCookieService.createAuthCookie(token)
        return "${cookie.name}=${cookie.value}"
    }

    @Test
    fun `root serves the SPA entry point`() {
        val response = get("/")
        assertEquals(200, response.statusCode())
        assertTrue(response.body().contains("porthole-spa-index"))
    }

    @Test
    fun `single segment client route serves the SPA entry point`() {
        val response = get("/lobby")
        assertEquals(200, response.statusCode())
        assertTrue(response.body().contains("porthole-spa-index"))
    }

    @Test
    fun `deep client route serves the SPA entry point for authenticated requests`() {
        val response = get("/session/${UUID.randomUUID()}/map", authCookieHeader())
        assertEquals(200, response.statusCode())
        assertTrue(response.body().contains("porthole-spa-index"))
    }

    @Test
    fun `existing static asset is served unchanged`() {
        val response = get("/assets/app.js")
        assertEquals(200, response.statusCode())
        assertTrue(response.body().contains("porthole-test-asset"))
    }

    @Test
    fun `missing asset is not rewritten to the SPA entry point`() {
        val response = get("/assets/missing.js")
        assertEquals(404, response.statusCode())
        assertFalse(response.body().contains("porthole-spa-index"))
    }

    @Test
    fun `unknown api path is not rewritten to the SPA entry point`() {
        val response = get("/api/auth/does-not-exist")
        assertEquals(404, response.statusCode())
        assertFalse(response.body().contains("porthole-spa-index"))
    }

    @Test
    fun `api routes still win over the SPA catch-all`() {
        val response = get("/api/auth/config")
        assertEquals(200, response.statusCode())
        assertTrue(response.body().contains("keycloakEnabled"))
    }
}
