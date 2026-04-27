package team.dedica.porthole.adapter.`in`.web

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import team.dedica.porthole.adapter.`in`.web.security.JwtAuthenticationFilter
import team.dedica.porthole.adapter.`in`.web.security.JwtTokenProvider
import team.dedica.porthole.adapter.`in`.web.security.SecurityConfig
import team.dedica.porthole.application.port.UserWritePort

@WebMvcTest(SpaController::class)
@Import(SecurityConfig::class, JwtAuthenticationFilter::class, JwtTokenProvider::class)
@ActiveProfiles("test")
class SpaControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @MockitoBean
    lateinit var userWritePort: UserWritePort

    @Test
    fun `root path forwards to index html`() {
        mockMvc.perform(get("/"))
            .andExpect(status().isOk)
            .andExpect(forwardedUrl("/index.html"))
    }

    @Test
    fun `lobby route forwards to index html`() {
        mockMvc.perform(get("/lobby"))
            .andExpect(status().isOk)
            .andExpect(forwardedUrl("/index.html"))
    }

    @Test
    fun `map deep link forwards to index html`() {
        mockMvc.perform(get("/map/abc-123"))
            .andExpect(status().isOk)
            .andExpect(forwardedUrl("/index.html"))
    }

    @Test
    fun `auth callback route forwards to index html`() {
        mockMvc.perform(get("/auth/github/callback"))
            .andExpect(status().isOk)
            .andExpect(forwardedUrl("/index.html"))
    }

    @Test
    fun `static js asset is NOT forwarded`() {
        // In WebMvcTest there are no real static files, so the response is 404.
        // The important assertion: it must never be forwarded to index.html.
        mockMvc.perform(get("/assets/main.abc123.js"))
            .andExpect(forwardedUrl(null))
    }
}

