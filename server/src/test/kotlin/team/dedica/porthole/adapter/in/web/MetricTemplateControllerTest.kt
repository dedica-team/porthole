package team.dedica.porthole.adapter.`in`.web

import tools.jackson.databind.ObjectMapper
import io.micronaut.runtime.server.EmbeddedServer
import io.micronaut.test.annotation.MockBean
import io.micronaut.test.extensions.junit5.annotation.MicronautTest
import jakarta.inject.Inject
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.whenever
import team.dedica.porthole.adapter.`in`.web.security.UserSessionStore
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.GetMetricTemplatesPort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.MetricTemplate
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

@MicronautTest
class MetricTemplateControllerTest {

    @Inject
    lateinit var server: EmbeddedServer

    @Inject
    lateinit var objectMapper: ObjectMapper

    @Inject
    lateinit var userSessionStore: UserSessionStore

    @Inject
    lateinit var getMetricTemplatesPort: GetMetricTemplatesPort

    @Inject
    lateinit var userPort: UserPort

    @MockBean(GetMetricTemplatesPort::class)
    fun getMetricTemplatesPort(): GetMetricTemplatesPort = org.mockito.kotlin.mock()

    @MockBean(UserPort::class)
    fun userPort(): UserPort = org.mockito.kotlin.mock()

    private val http: HttpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .build()

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
        whenever(userPort.findById(testUserId)).thenReturn(UserRecord(id = testUserId, username = "testuser"))
        return userSessionStore.createSession(testUserId, "testuser")
    }

    private fun get(path: String, bearer: String? = null): HttpResponse<String> {
        val builder = HttpRequest.newBuilder(URI.create("http://localhost:${server.port}$path"))
        if (bearer != null) builder.header("Authorization", "Bearer $bearer")
        builder.method("GET", HttpRequest.BodyPublishers.noBody())
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString())
    }

    private fun authedGet(): HttpResponse<String> = get("/api/metric-templates", token())

    @Test
    fun `GET metric-templates returns 200 with correct content type`() {
        whenever(getMetricTemplatesPort.getTemplates()).thenReturn(allTemplates)

        val response = authedGet()
        assertTrue(response.statusCode() == 200)
        assertTrue(response.headers().firstValue("Content-Type").orElse("").contains("application/json"))
    }

    @Test
    fun `GET metric-templates returns all 27 templates`() {
        whenever(getMetricTemplatesPort.getTemplates()).thenReturn(allTemplates)

        val response = authedGet()
        assertTrue(response.statusCode() == 200)
        assertTrue(objectMapper.readTree(response.body()).size() == 27)
    }

    @Test
    fun `GET metric-templates each entry has id name and description`() {
        whenever(getMetricTemplatesPort.getTemplates()).thenReturn(allTemplates)

        val tree = objectMapper.readTree(authedGet().body())
        assertTrue(tree[0]["id"].isTextual)
        assertTrue(tree[0]["name"].isTextual)
        assertTrue(tree[0]["description"].isTextual)
    }

    @Test
    fun `GET metric-templates contains all 12-factor ids`() {
        whenever(getMetricTemplatesPort.getTemplates()).thenReturn(allTemplates)

        val body = authedGet().body()
        listOf(
            "codebase", "dependencies", "config", "backing-services",
            "build-release-run", "processes", "port-binding", "concurrency",
            "disposability", "dev-prod-parity", "logs", "admin-processes",
        ).forEach { id -> assertTrue(body.contains("\"$id\"")) { "Missing 12-factor id: $id" } }
    }

    @Test
    fun `GET metric-templates contains all NFR ids`() {
        whenever(getMetricTemplatesPort.getTemplates()).thenReturn(allTemplates)

        val body = authedGet().body()
        listOf(
            "availability", "response-time", "throughput", "error-rate",
            "scalability", "recoverability", "mttr", "security",
            "observability", "api-stability", "data-consistency",
            "test-coverage", "deployment-frequency", "slo-compliance", "documentation",
        ).forEach { id -> assertTrue(body.contains("\"$id\"")) { "Missing NFR id: $id" } }
    }

    @Test
    fun `GET metric-templates does not set a custom max-age cache header`() {
        whenever(getMetricTemplatesPort.getTemplates()).thenReturn(allTemplates)

        val response = authedGet()
        assertTrue(response.statusCode() == 200)
        val cacheControl = response.headers().firstValue("Cache-Control").orElse("")
        assertTrue(!cacheControl.contains("max-age=3600"),
            "Controller must not set a permissive max-age cache header, got: $cacheControl")
    }

    @Test
    fun `GET metric-templates without auth returns 401 or 403`() {
        val status = get("/api/metric-templates").statusCode()
        assertTrue(status == 401 || status == 403)
    }
}
