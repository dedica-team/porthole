package team.dedica.porthole.adapter.`in`.web
import java.util.UUID

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import team.dedica.porthole.adapter.`in`.web.security.*
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.GetMetricTemplatesPort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.config.PortholeAuthProperties
import team.dedica.porthole.domain.MetricTemplate

@WebMvcTest(MetricTemplateController::class)
@Import(SecurityConfig::class, JwtAuthenticationFilter::class, JwtTokenProvider::class,
    AuthCookieService::class, KeycloakClientRegistrationConfig::class,
    MetricTemplateControllerTest.TestConfig::class)
@ActiveProfiles("test")
class MetricTemplateControllerTest {

    @TestConfiguration
    @EnableConfigurationProperties(PortholeAuthProperties::class)
    class TestConfig

    @Autowired lateinit var mockMvc: MockMvc
    @Autowired lateinit var objectMapper: ObjectMapper
    @Autowired lateinit var jwtTokenProvider: JwtTokenProvider

    @MockitoBean
    lateinit var getMetricTemplatesPort: GetMetricTemplatesPort

    @MockitoBean
    lateinit var userPort: UserPort

    private val allTemplates = listOf(
        // 12-factor
        MetricTemplate("codebase",          "Codebase",               "One codebase tracked in version control, many deploys."),
        MetricTemplate("dependencies",       "Dependencies",           "Explicitly declare and isolate dependencies."),
        MetricTemplate("config",             "Config",                 "Store config in the environment."),
        MetricTemplate("backing-services",   "Backing Services",       "Treat backing services as attached resources."),
        MetricTemplate("build-release-run",  "Build / Release / Run",  "Strictly separate build and run stages."),
        MetricTemplate("processes",          "Processes",              "Execute the app as one or more stateless processes."),
        MetricTemplate("port-binding",       "Port Binding",           "Export services via port binding."),
        MetricTemplate("concurrency",        "Concurrency",            "Scale out via the process model."),
        MetricTemplate("disposability",      "Disposability",          "Maximize robustness with fast startup and graceful shutdown."),
        MetricTemplate("dev-prod-parity",    "Dev / Prod Parity",      "Keep development, staging, and production as similar as possible."),
        MetricTemplate("logs",               "Logs",                   "Treat logs as event streams."),
        MetricTemplate("admin-processes",    "Admin Processes",        "Run admin/management tasks as one-off processes."),
        // NFR
        MetricTemplate("availability",         "Availability",                   "Percentage of time the service is operational and reachable."),
        MetricTemplate("response-time",        "Response Time",                  "Latency from request to response under normal load."),
        MetricTemplate("throughput",           "Throughput",                     "Requests or transactions the service handles per unit of time."),
        MetricTemplate("error-rate",           "Error Rate",                     "Percentage of requests that result in an error."),
        MetricTemplate("scalability",          "Scalability",                    "Ability to handle increasing load by adding resources."),
        MetricTemplate("recoverability",       "Recoverability",                 "Speed and completeness of recovery after a failure."),
        MetricTemplate("mttr",                 "Mean Time to Recover (MTTR)",    "Average time to restore service after an incident."),
        MetricTemplate("security",             "Security",                       "Degree to which the service protects data and resists attacks."),
        MetricTemplate("observability",        "Observability",                  "Ability to understand internal state from external outputs."),
        MetricTemplate("api-stability",        "API Stability",                  "Degree to which the public API contract is stable over time."),
        MetricTemplate("data-consistency",     "Data Consistency",               "Guarantee that data remains accurate and coherent."),
        MetricTemplate("test-coverage",        "Test Coverage",                  "Proportion of code exercised by automated tests."),
        MetricTemplate("deployment-frequency", "Deployment Frequency",           "How often new versions are released to production."),
        MetricTemplate("slo-compliance",       "SLO Compliance",                 "Percentage of time the service meets its SLOs."),
        MetricTemplate("documentation",        "Documentation",                  "Completeness and accuracy of technical documentation."),
    )

    private fun token(): String {
        val testUserId = UUID.nameUUIDFromBytes("test-user-id".toByteArray())
        given(userPort.findById(testUserId)).willReturn(UserRecord(id = testUserId, username = "testuser"))
        return jwtTokenProvider.generateToken(testUserId, "testuser")
    }

    @Test
    fun `GET metric-templates returns 200 with correct content type`() {
        given(getMetricTemplatesPort.getTemplates()).willReturn(allTemplates)

        mockMvc.perform(get("/api/metric-templates").header("Authorization", "Bearer ${token()}"))
            .andExpect(status().isOk)
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
    }

    @Test
    fun `GET metric-templates returns all 27 templates`() {
        given(getMetricTemplatesPort.getTemplates()).willReturn(allTemplates)

        mockMvc.perform(get("/api/metric-templates").header("Authorization", "Bearer ${token()}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(27))
    }

    @Test
    fun `GET metric-templates each entry has id name and description`() {
        given(getMetricTemplatesPort.getTemplates()).willReturn(allTemplates)

        mockMvc.perform(get("/api/metric-templates").header("Authorization", "Bearer ${token()}"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].id").isString)
            .andExpect(jsonPath("$[0].name").isString)
            .andExpect(jsonPath("$[0].description").isString)
    }

    @Test
    fun `GET metric-templates contains all 12-factor ids`() {
        given(getMetricTemplatesPort.getTemplates()).willReturn(allTemplates)

        val result = mockMvc.perform(get("/api/metric-templates").header("Authorization", "Bearer ${token()}"))
            .andExpect(status().isOk)
            .andReturn()

        val body = result.response.contentAsString
        listOf(
            "codebase", "dependencies", "config", "backing-services",
            "build-release-run", "processes", "port-binding", "concurrency",
            "disposability", "dev-prod-parity", "logs", "admin-processes",
        ).forEach { id -> assert(body.contains("\"$id\"")) { "Missing 12-factor id: $id" } }
    }

    @Test
    fun `GET metric-templates contains all NFR ids`() {
        given(getMetricTemplatesPort.getTemplates()).willReturn(allTemplates)

        val result = mockMvc.perform(get("/api/metric-templates").header("Authorization", "Bearer ${token()}"))
            .andExpect(status().isOk)
            .andReturn()

        val body = result.response.contentAsString
        listOf(
            "availability", "response-time", "throughput", "error-rate",
            "scalability", "recoverability", "mttr", "security",
            "observability", "api-stability", "data-consistency",
            "test-coverage", "deployment-frequency", "slo-compliance", "documentation",
        ).forEach { id -> assert(body.contains("\"$id\"")) { "Missing NFR id: $id" } }
    }

    @Test
    fun `GET metric-templates does not set a custom max-age cache header`() {
        given(getMetricTemplatesPort.getTemplates()).willReturn(allTemplates)

        // Spring Security always adds Cache-Control: no-cache, no-store.
        // We verify our controller does NOT override this with a permissive max-age.
        mockMvc.perform(get("/api/metric-templates").header("Authorization", "Bearer ${token()}"))
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("max-age=3600"))))
    }

    @Test
    fun `GET metric-templates without auth returns 401 or 403`() {
        val status = mockMvc.perform(get("/api/metric-templates"))
            .andReturn().response.status
        assertTrue(status == 401 || status == 403)
    }
}
