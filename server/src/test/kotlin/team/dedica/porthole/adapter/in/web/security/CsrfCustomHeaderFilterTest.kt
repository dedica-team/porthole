package team.dedica.porthole.adapter.`in`.web.security

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.MutableHttpRequest
import io.micronaut.http.MutableHttpResponse
import io.micronaut.http.filter.ServerFilterChain
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import reactor.core.publisher.Mono

class CsrfCustomHeaderFilterTest {

    private val filter = CsrfCustomHeaderFilter()

    private val proceedChain = ServerFilterChain { Mono.just(HttpResponse.ok<Any>()) }

    private fun doFilter(request: HttpRequest<*>): MutableHttpResponse<*> =
        Mono.from(filter.doFilter(request, proceedChain)).block()!!

    private fun get(uri: String): MutableHttpRequest<*> = HttpRequest.GET<Any>(uri)
    private fun post(uri: String): MutableHttpRequest<*> = HttpRequest.POST(uri, "")
    private fun put(uri: String): MutableHttpRequest<*> = HttpRequest.PUT(uri, "")
    private fun patch(uri: String): MutableHttpRequest<*> = HttpRequest.PATCH(uri, "")
    private fun delete(uri: String): MutableHttpRequest<*> = HttpRequest.DELETE<Any>(uri)
    private fun options(uri: String): MutableHttpRequest<*> = HttpRequest.OPTIONS<Any>(uri)
    private fun head(uri: String): MutableHttpRequest<*> = HttpRequest.HEAD(uri)

    // ── Safe methods are always allowed ─────────────────────────────────────

    @Test
    fun `GET requests to api pass without custom header`() {
        val res = doFilter(get("/api/sessions"))
        assertNotEquals(HttpStatus.FORBIDDEN, res.status)
    }

    @Test
    fun `OPTIONS requests to api pass without custom header`() {
        val res = doFilter(options("/api/sessions"))
        assertNotEquals(HttpStatus.FORBIDDEN, res.status)
    }

    @Test
    fun `HEAD requests to api pass without custom header`() {
        val res = doFilter(head("/api/sessions"))
        assertNotEquals(HttpStatus.FORBIDDEN, res.status)
    }

    // ── Non-api paths are exempt ────────────────────────────────────────────

    @Test
    fun `POST to non-api path passes without custom header`() {
        val res = doFilter(post("/oauth2/authorization/keycloak"))
        assertNotEquals(HttpStatus.FORBIDDEN, res.status)
    }

    // ── State-changing api requests require the header ──────────────────────

    @Test
    fun `POST to api without custom header returns 403`() {
        val res = doFilter(post("/api/sessions"))
        assertEquals(HttpStatus.FORBIDDEN, res.status)
    }

    @Test
    fun `PUT to api without custom header returns 403`() {
        val res = doFilter(put("/api/sessions/1/landmarks/2/metrics/3"))
        assertEquals(HttpStatus.FORBIDDEN, res.status)
    }

    @Test
    fun `PATCH to api without custom header returns 403`() {
        val res = doFilter(patch("/api/sessions/1"))
        assertEquals(HttpStatus.FORBIDDEN, res.status)
    }

    @Test
    fun `DELETE to api without custom header returns 403`() {
        val res = doFilter(delete("/api/sessions/1/landmarks/2"))
        assertEquals(HttpStatus.FORBIDDEN, res.status)
    }

    // ── Header present → allowed ────────────────────────────────────────────

    @Test
    fun `POST to api with X-Requested-With header passes`() {
        val res = doFilter(post("/api/sessions").header("X-Requested-With", "XMLHttpRequest"))
        assertNotEquals(HttpStatus.FORBIDDEN, res.status)
    }

    @Test
    fun `DELETE to api with X-Requested-With header passes`() {
        val res = doFilter(delete("/api/sessions/1").header("X-Requested-With", "XMLHttpRequest"))
        assertNotEquals(HttpStatus.FORBIDDEN, res.status)
    }

    // ── Bearer token bypasses the custom header check ───────────────────────

    @Test
    fun `POST to api with Bearer auth passes without custom header`() {
        val res = doFilter(post("/api/sessions").header("Authorization", "Bearer some-jwt-token"))
        assertNotEquals(HttpStatus.FORBIDDEN, res.status)
    }

    // ── Auth endpoints also require the header (cookie-based) ───────────────

    @Test
    fun `POST to auth endpoint without custom header returns 403`() {
        val res = doFilter(post("/api/auth/github/start"))
        assertEquals(HttpStatus.FORBIDDEN, res.status)
    }

    @Test
    fun `POST to auth endpoint with custom header passes`() {
        val res = doFilter(post("/api/auth/github/start").header("X-Requested-With", "XMLHttpRequest"))
        assertNotEquals(HttpStatus.FORBIDDEN, res.status)
    }
}
