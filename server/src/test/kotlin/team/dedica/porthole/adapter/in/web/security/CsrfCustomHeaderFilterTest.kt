package team.dedica.porthole.adapter.`in`.web.security

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse

class CsrfCustomHeaderFilterTest {

    private val filter = CsrfCustomHeaderFilter()

    private fun request(method: String, uri: String): MockHttpServletRequest =
        MockHttpServletRequest(method, uri)

    private fun doFilter(req: MockHttpServletRequest): MockHttpServletResponse {
        val res = MockHttpServletResponse()
        val chain = MockFilterChain()
        filter.doFilter(req, res, chain)
        return res
    }

    // ── Safe methods are always allowed ─────────────────────────────────────

    @Test
    fun `GET requests to api pass without custom header`() {
        val res = doFilter(request("GET", "/api/maps"))
        assertNotEquals(403, res.status)
    }

    @Test
    fun `OPTIONS requests to api pass without custom header`() {
        val res = doFilter(request("OPTIONS", "/api/maps"))
        assertNotEquals(403, res.status)
    }

    @Test
    fun `HEAD requests to api pass without custom header`() {
        val res = doFilter(request("HEAD", "/api/maps"))
        assertNotEquals(403, res.status)
    }

    // ── Non-api paths are exempt ────────────────────────────────────────────

    @Test
    fun `POST to non-api path passes without custom header`() {
        val res = doFilter(request("POST", "/oauth2/authorization/keycloak"))
        assertNotEquals(403, res.status)
    }

    // ── State-changing api requests require the header ──────────────────────

    @Test
    fun `POST to api without custom header returns 403`() {
        val res = doFilter(request("POST", "/api/maps"))
        assertEquals(403, res.status)
    }

    @Test
    fun `PUT to api without custom header returns 403`() {
        val res = doFilter(request("PUT", "/api/maps/1/landmarks/2/metrics/3"))
        assertEquals(403, res.status)
    }

    @Test
    fun `PATCH to api without custom header returns 403`() {
        val res = doFilter(request("PATCH", "/api/maps/1"))
        assertEquals(403, res.status)
    }

    @Test
    fun `DELETE to api without custom header returns 403`() {
        val res = doFilter(request("DELETE", "/api/maps/1/landmarks/2"))
        assertEquals(403, res.status)
    }

    // ── Header present → allowed ────────────────────────────────────────────

    @Test
    fun `POST to api with X-Requested-With header passes`() {
        val req = request("POST", "/api/maps").apply {
            addHeader("X-Requested-With", "XMLHttpRequest")
        }
        val res = doFilter(req)
        assertNotEquals(403, res.status)
    }

    @Test
    fun `DELETE to api with X-Requested-With header passes`() {
        val req = request("DELETE", "/api/maps/1").apply {
            addHeader("X-Requested-With", "XMLHttpRequest")
        }
        val res = doFilter(req)
        assertNotEquals(403, res.status)
    }

    // ── Bearer token bypasses the custom header check ───────────────────────

    @Test
    fun `POST to api with Bearer auth passes without custom header`() {
        val req = request("POST", "/api/maps").apply {
            addHeader("Authorization", "Bearer some-jwt-token")
        }
        val res = doFilter(req)
        assertNotEquals(403, res.status)
    }

    // ── Auth endpoints also require the header (cookie-based) ───────────────

    @Test
    fun `POST to auth endpoint without custom header returns 403`() {
        val res = doFilter(request("POST", "/api/auth/github/start"))
        assertEquals(403, res.status)
    }

    @Test
    fun `POST to auth endpoint with custom header passes`() {
        val req = request("POST", "/api/auth/github/start").apply {
            addHeader("X-Requested-With", "XMLHttpRequest")
        }
        val res = doFilter(req)
        assertNotEquals(403, res.status)
    }
}

