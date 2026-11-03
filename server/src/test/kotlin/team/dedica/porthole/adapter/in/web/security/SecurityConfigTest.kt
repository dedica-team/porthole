package team.dedica.porthole.adapter.`in`.web.security

import io.micronaut.runtime.server.EmbeddedServer
import io.micronaut.test.extensions.junit5.annotation.MicronautTest
import jakarta.inject.Inject
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.http.WebSocket
import java.net.http.WebSocketHandshakeException
import java.util.concurrent.CompletionException

/**
 * Integration tests for the Micronaut security configuration.
 *
 * Boots the real application on an embedded server and asserts the HTTP-level
 * behaviour that the former Spring `SecurityConfig` test covered: public vs.
 * protected endpoints, WebSocket handshake rejection, and CORS preflight.
 */
@MicronautTest
class SecurityConfigTest {

    @Inject
    lateinit var server: EmbeddedServer

    @Inject
    lateinit var jwtTokenValidator: io.micronaut.security.token.jwt.validator.ReactiveJsonWebTokenValidator<*, *>

    private val http: HttpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .build()

    private fun exchange(
        method: String,
        path: String,
        headers: Map<String, String> = emptyMap(),
    ): HttpResponse<String> {
        val builder = HttpRequest.newBuilder(URI.create("http://localhost:${server.port}$path"))
        headers.forEach { (name, value) -> builder.header(name, value) }
        builder.method(method, HttpRequest.BodyPublishers.noBody())
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString())
    }

    @Test
    fun `jwtTokenValidator bean is present for oauth2 openid validation`() {
        assertNotNull(jwtTokenValidator)
    }

    // Regression: the WebSocket endpoint must not be blocked with 403.
    // Anonymous handshakes are rejected by the security layer with 401 before
    // ever reaching the WebSocket protocol handler.
    @Test
    fun `ws-native anonymous handshake is rejected with 401 rather than 403`() {
        val failure = assertThrows(CompletionException::class.java) {
            http.newWebSocketBuilder()
                .buildAsync(
                    URI.create("ws://localhost:${server.port}/ws-native"),
                    object : WebSocket.Listener {},
                )
                .join()
        }
        val handshakeFailure = failure.cause as WebSocketHandshakeException
        val response: HttpResponse<*> = handshakeFailure.response
        assertEquals(401, response.statusCode())
    }

    @Test
    fun `ws endpoint is not forbidden`() {
        val status = exchange("GET", "/ws").statusCode()
        assertNotEquals(403, status)
    }

    @Test
    fun `api auth endpoints are accessible without authentication`() {
        val response = exchange(
            "OPTIONS",
            "/api/auth/github/start",
            mapOf(
                "Origin" to "http://localhost:5173",
                "Access-Control-Request-Method" to "POST",
            ),
        )
        assertEquals(200, response.statusCode())
    }

    @Test
    fun `auth config endpoint is accessible without authentication`() {
        val response = exchange("GET", "/api/auth/config")
        assertEquals(200, response.statusCode())
    }

    @Test
    fun `protected api endpoint returns 401 or 403 without token`() {
        val status = exchange("GET", "/api/sessions").statusCode()
        assertTrue(status == 401 || status == 403,
            "Expected 401 or 403 for unauthenticated request, got $status")
    }

    @Test
    fun `health endpoint and probes are accessible without authentication`() {
        val health = exchange("GET", "/health")
        assertEquals(200, health.statusCode())
        assertTrue(health.body().contains("\"status\":\"UP\""))

        val liveness = exchange("GET", "/health/liveness")
        assertEquals(200, liveness.statusCode())
        assertTrue(liveness.body().contains("\"status\":\"UP\""))

        val readiness = exchange("GET", "/health/readiness")
        assertEquals(200, readiness.statusCode())
        assertTrue(readiness.body().contains("\"status\":\"UP\""))
    }

    // Regression: CORS was not configured, blocking cross-origin requests from
    // the Vite dev server (localhost:5173) to the backend.
    @Test
    fun `CORS preflight from Vite dev origin is accepted`() {
        val response = exchange(
            "OPTIONS",
            "/api/sessions",
            mapOf(
                "Origin" to "http://localhost:5173",
                "Access-Control-Request-Method" to "GET",
            ),
        )
        assertEquals(200, response.statusCode())
    }
}
