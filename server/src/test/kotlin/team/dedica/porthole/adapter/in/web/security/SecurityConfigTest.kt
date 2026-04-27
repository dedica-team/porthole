package team.dedica.porthole.adapter.`in`.web.security

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.ContextConfiguration
import team.dedica.porthole.TestStorageCleaner

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test", "dev")
@ContextConfiguration(initializers = [TestStorageCleaner::class])
class SecurityConfigTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    // Regression: /ws-native must not be blocked by Spring Security with 403.
    // Anonymous handshakes are now rejected by the application-level auth layer with 401.
    @Test
    fun `ws-native anonymous handshake is rejected with 401 rather than 403`() {
        val result = mockMvc.perform(get("/ws-native")).andReturn()
        val status = result.response.status
        assertEquals(401, status, "/ws-native should reject anonymous handshakes with 401")
    }

    @Test
    fun `ws SockJS anonymous handshake is not forbidden by Spring Security`() {
        val result = mockMvc.perform(get("/ws")).andReturn()
        val status = result.response.status
        assertNotEquals(403, status)
    }

    @Test
    fun `api auth endpoints are accessible without authentication`() {
        mockMvc.perform(
            options("/api/auth/login")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "POST")
        ).andExpect(status().isOk)
    }

    @Test
    fun `auth config endpoint is accessible without authentication`() {
        mockMvc.perform(get("/api/auth/config"))
            .andExpect(status().isOk)
    }

    @Test
    fun `protected api endpoint returns 401 or 403 without token`() {
        val status = mockMvc.perform(get("/api/maps")).andReturn().response.status
        assertTrue(status == 401 || status == 403,
            "Expected 401 or 403 for unauthenticated request, got $status")
    }

    // Regression: CORS was not configured, blocking cross-origin requests from
    // the Vite dev server (localhost:5173) to the backend (localhost:8080).
    @Test
    fun `CORS preflight from Vite dev origin is accepted`() {
        mockMvc.perform(
            options("/api/maps")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "GET")
        ).andExpect(status().isOk)
    }
}

