package team.dedica.porthole.adapter.`in`.web

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import io.micronaut.runtime.server.EmbeddedServer
import io.micronaut.test.extensions.junit5.annotation.MicronautTest
import jakarta.inject.Inject
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.`in`.web.security.UserSessionStore
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.*
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

@MicronautTest
class MetricControllerPushValuesTest {

    @Inject
    lateinit var server: EmbeddedServer

    @Inject
    lateinit var userSessionStore: UserSessionStore

    @Inject
    lateinit var sessionStatePort: SessionStatePort

    @Inject
    lateinit var userPort: UserPort

    private val objectMapper = ObjectMapper()

    private lateinit var token: String
    private lateinit var sessionId: UUID
    private lateinit var metricId: UUID
    private lateinit var landmarkId: UUID

    private val http: HttpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .build()

    @BeforeEach
    fun setup() {
        if (userPort.findByUsername("metricuser") == null) {
            userPort.save(
                UserRecord(
                    id = UUID.nameUUIDFromBytes("test-metric-user".toByteArray()),
                    username = "metricuser",
                    githubId = "gh-metric"
                )
            )
        }
        val user = userPort.findByUsername("metricuser")!!
        token = userSessionStore.createSession(user.id, user.username)

        sessionId = UUID.randomUUID()
        metricId = UUID.randomUUID()
        landmarkId = UUID.randomUUID()

        val metric = QualityMetric(id = metricId, name = "Code Coverage", description = "Test coverage percentage")
        val landmark = Landmark(
            id = landmarkId,
            name = "Payment Gateway",
            links = mapOf("repo" to "https://github.com/org/payment-gateway.git")
        )

        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
        val state = SessionState(id = sessionId, map = map).also {
            it.collaborators.add(Collaborator(id = user.id, username = user.username))
            it.metrics[metricId] = metric
            it.landmarks[landmarkId] = landmark
        }
        sessionStatePort.save(state)
    }

    private fun send(
        method: String,
        path: String,
        body: Any? = null,
        bearer: String? = token,
    ): HttpResponse<String> {
        val builder = HttpRequest.newBuilder(URI.create("http://localhost:${server.port}$path"))
        if (bearer != null) builder.header("Authorization", "Bearer $bearer")
        builder.header("X-Requested-With", "XMLHttpRequest")
        if (body != null) {
            builder.header("Content-Type", "application/json")
            builder.method(method, HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
        } else {
            builder.method(method, HttpRequest.BodyPublishers.noBody())
        }
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString())
    }

    private fun json(response: HttpResponse<String>): JsonNode = objectMapper.readTree(response.body())

    @Test
    fun `POST push metric values by metric id returns 200 OK and summary`() {
        val body = mapOf(
            "matchBy" to "NAME",
            "values" to listOf(
                mapOf(
                    "element" to "Payment Gateway",
                    "value" to "92%",
                    "level" to "OK",
                    "description" to "Coverage above target",
                ),
                mapOf(
                    "element" to "Unmatched Service",
                    "value" to "50%",
                )
            )
        )

        val response = send("POST", "/api/sessions/$sessionId/metrics/$metricId/values", body)
        assertEquals(200, response.statusCode())

        val root = json(response)
        assertEquals(1, root["updatedCount"].asInt())
        assertEquals(1, root["unmatchedElements"].size())
        assertEquals("Unmatched Service", root["unmatchedElements"][0].asString())

        val state = sessionStatePort.findById(sessionId)!!
        val updatedMetric = state.landmarks[landmarkId]?.metrics?.get(metricId)
        assertNotNull(updatedMetric)
        assertEquals("92%", updatedMetric?.value)
        assertEquals(QualityLevel.OK, updatedMetric?.level)
    }

    @Test
    fun `POST push metric values by metric name returns error`() {
        val body = mapOf(
            "matchBy" to "NAME",
            "values" to listOf(
                mapOf(
                    "element" to "Payment Gateway",
                    "value" to "92%",
                )
            )
        )

        val response = send("POST", "/api/sessions/$sessionId/metrics/Code%20Coverage/values", body)
        assertTrue(response.statusCode() in listOf(400, 404, 500))
    }

    @Test
    fun `POST push metric values by link matches canonical URL`() {
        val body = mapOf(
            "matchBy" to "LINK",
            "values" to listOf(
                mapOf(
                    "element" to "git@github.com:org/payment-gateway.git",
                    "value" to "95%",
                    "level" to "OK"
                )
            )
        )

        val response = send("POST", "/api/sessions/$sessionId/metrics/$metricId/values", body)
        assertEquals(200, response.statusCode())

        val root = json(response)
        assertEquals(1, root["updatedCount"].asInt())
        assertEquals(0, root["unmatchedElements"].size())
    }

    @Test
    fun `PUT and DELETE metric transformation lifecycle`() {
        val body = mapOf(
            "name" to "SonarQube Sync",
            "requestUrl" to "https://sonar.example.com/api/measures",
            "httpMethod" to "GET",
            "jqFilter" to "[.component.measures[] | {element: .component, value: .value}]",
            "matchBy" to "NAME",
        )

        val putResponse = send("PUT", "/api/sessions/$sessionId/metrics/$metricId/transformations", body)
        assertEquals(200, putResponse.statusCode())

        val stateAfterPut = sessionStatePort.findById(sessionId)!!
        val metricWitTransformation = stateAfterPut.metrics[metricId]!!
        assertEquals(1, metricWitTransformation.transformations.size)
        val transformationId = metricWitTransformation.transformations.first().id

        val deleteResponse = send("DELETE", "/api/sessions/$sessionId/metrics/$metricId/transformations/$transformationId")
        assertEquals(200, deleteResponse.statusCode())

        val stateAfterDelete = sessionStatePort.findById(sessionId)!!
        assertTrue(stateAfterDelete.metrics[metricId]!!.transformations.isEmpty())
    }

    @Test
    fun `DELETE metric deletes metric and its transformations`() {
        val body = mapOf(
            "name" to "GitLab MRs Ingestion",
            "requestUrl" to "https://gitlab.example.com/api/graphql",
            "httpMethod" to "POST",
            "jqFilter" to "[.data.group.projects.nodes[]]",
            "matchBy" to "NAME",
        )

        val putResponse = send("PUT", "/api/sessions/$sessionId/metrics/$metricId/transformations", body)
        assertEquals(200, putResponse.statusCode())

        val stateAfterPut = sessionStatePort.findById(sessionId)!!
        assertEquals(1, stateAfterPut.metrics[metricId]!!.transformations.size)

        val deleteMetricResponse = send("DELETE", "/api/sessions/$sessionId/metrics/$metricId")
        assertEquals(200, deleteMetricResponse.statusCode())

        val stateAfterDelete = sessionStatePort.findById(sessionId)!!
        assertFalse(stateAfterDelete.metrics.containsKey(metricId))
        assertNull(stateAfterDelete.metrics[metricId])
    }

    @Test
    fun `POST generate push token returns 200 OK and valid JWT`() {
        val response = send("POST", "/api/sessions/$sessionId/metrics/$metricId/token")
        assertEquals(200, response.statusCode())

        val root = json(response)
        assertTrue(root.has("token"))
        val pushToken = root["token"].asString()
        assertTrue(pushToken.isNotBlank())
        assertEquals(3, pushToken.split(".").size)
    }

    @Test
    fun `POST push values with scoped JWT succeeds`() {
        val tokenResponse = send("POST", "/api/sessions/$sessionId/metrics/$metricId/token")
        assertEquals(200, tokenResponse.statusCode())
        val pushJwt = json(tokenResponse)["token"].asString()

        val body = mapOf(
            "matchBy" to "NAME",
            "values" to listOf(
                mapOf(
                    "element" to "Payment Gateway",
                    "value" to "99%",
                    "level" to "OK"
                )
            )
        )

        val pushResponse = send(
            method = "POST",
            path = "/api/sessions/$sessionId/metrics/$metricId/values",
            body = body,
            bearer = pushJwt,
        )
        assertEquals(200, pushResponse.statusCode())
        assertEquals(1, json(pushResponse)["updatedCount"].asInt())

        val state = sessionStatePort.findById(sessionId)!!
        assertEquals("99%", state.landmarks[landmarkId]?.metrics?.get(metricId)?.value)
    }

    @Test
    fun `POST push values with scoped JWT to different session returns 403 Forbidden`() {
        val tokenResponse = send("POST", "/api/sessions/$sessionId/metrics/$metricId/token")
        assertEquals(200, tokenResponse.statusCode())
        val pushJwt = json(tokenResponse)["token"].asString()

        val otherSessionId = UUID.randomUUID()
        val user = userPort.findByUsername("metricuser")!!
        val otherState = SessionState(id = otherSessionId, map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 })).apply {
            collaborators.add(Collaborator(id = user.id, username = user.username))
            metrics[metricId] = QualityMetric(id = metricId, name = "Code Coverage", description = "Test coverage")
        }
        sessionStatePort.save(otherState)

        val body = mapOf(
            "matchBy" to "NAME",
            "values" to listOf(
                mapOf(
                    "element" to "Payment Gateway",
                    "value" to "99%",
                )
            )
        )

        val pushResponse = send(
            method = "POST",
            path = "/api/sessions/$otherSessionId/metrics/$metricId/values",
            body = body,
            bearer = pushJwt,
        )
        assertEquals(403, pushResponse.statusCode())
    }

    @Test
    fun `POST push values with scoped JWT to different metric returns 403 Forbidden`() {
        val tokenResponse = send("POST", "/api/sessions/$sessionId/metrics/$metricId/token")
        assertEquals(200, tokenResponse.statusCode())
        val pushJwt = json(tokenResponse)["token"].asString()

        val otherMetricId = UUID.randomUUID()
        val state = sessionStatePort.findById(sessionId)!!
        state.metrics[otherMetricId] = QualityMetric(id = otherMetricId, name = "Bugs", description = "Bug count")
        sessionStatePort.save(state)

        val body = mapOf(
            "matchBy" to "NAME",
            "values" to listOf(
                mapOf(
                    "element" to "Payment Gateway",
                    "value" to "0",
                )
            )
        )

        val pushResponse = send(
            method = "POST",
            path = "/api/sessions/$sessionId/metrics/$otherMetricId/values",
            body = body,
            bearer = pushJwt,
        )
        assertEquals(403, pushResponse.statusCode())
    }

    @Test
    fun `non-push endpoints with scoped JWT return 403 Forbidden`() {
        val tokenResponse = send("POST", "/api/sessions/$sessionId/metrics/$metricId/token")
        assertEquals(200, tokenResponse.statusCode())
        val pushJwt = json(tokenResponse)["token"].asString()

        val getMetricsResponse = send(
            method = "GET",
            path = "/api/sessions/$sessionId/metrics",
            bearer = pushJwt,
        )
        assertEquals(403, getMetricsResponse.statusCode())

        val deleteResponse = send(
            method = "DELETE",
            path = "/api/sessions/$sessionId/metrics/$metricId",
            bearer = pushJwt,
        )
        assertEquals(403, deleteResponse.statusCode())
    }
}
