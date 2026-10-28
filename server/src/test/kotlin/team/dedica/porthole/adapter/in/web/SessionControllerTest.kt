package team.dedica.porthole.adapter.`in`.web

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import io.micronaut.runtime.server.EmbeddedServer
import io.micronaut.test.extensions.junit5.annotation.MicronautTest
import jakarta.inject.Inject
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.`in`.web.security.JwtTokenProvider
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.Landmark
import team.dedica.porthole.domain.LandmarkGroup
import team.dedica.porthole.domain.SessionState
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

/**
 * End-to-end integration tests for the session/map REST API, migrated from the
 * former Spring `MockMvc` test to a real embedded Micronaut server.
 */
@MicronautTest
class SessionControllerTest {

    @Inject
    lateinit var server: EmbeddedServer

    @Inject
    lateinit var jwtTokenProvider: JwtTokenProvider

    @Inject
    lateinit var sessionStatePort: SessionStatePort

    @Inject
    lateinit var userPort: UserPort

    private val objectMapper = ObjectMapper()

    private lateinit var token: String
    private lateinit var viewerToken: String
    private lateinit var mapId: UUID

    private val http: HttpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .build()

    @BeforeEach
    fun setup() {
        if (userPort.findByUsername("sessionuser") == null) {
            userPort.save(
                UserRecord(
                    id = UUID.nameUUIDFromBytes("test-uid-001".toByteArray()),
                    username = "sessionuser",
                    githubId = "gh-test"
                )
            )
        }
        val user = userPort.findByUsername("sessionuser")!!
        token = jwtTokenProvider.generateToken(user.id, user.username)

        if (userPort.findByUsername("viewer") == null) {
            userPort.save(
                UserRecord(
                    id = UUID.nameUUIDFromBytes("test-viewer-001".toByteArray()),
                    username = "viewer",
                    githubId = "gh-viewer"
                )
            )
        }
        val viewer = userPort.findByUsername("viewer")!!
        viewerToken = jwtTokenProvider.generateToken(viewer.id, viewer.username)

        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        val state = SessionState(map = map).also {
            it.collaborators.add(Collaborator(id = user.id, username = user.username))
        }
        sessionStatePort.save(state)
        mapId = state.id
    }

    // ── HTTP helpers ─────────────────────────────────────────────────────────

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

    private fun get(path: String, bearer: String? = token) = send("GET", path, null, bearer)
    private fun post(path: String, body: Any? = null, bearer: String? = token) = send("POST", path, body, bearer)
    private fun patch(path: String, body: Any?, bearer: String? = token) = send("PATCH", path, body, bearer)
    private fun put(path: String, body: Any?, bearer: String? = token) = send("PUT", path, body, bearer)
    private fun delete(path: String, bearer: String? = token) = send("DELETE", path, null, bearer)

    private fun json(response: HttpResponse<String>): JsonNode = objectMapper.readTree(response.body())

    private fun isNullOrMissing(node: JsonNode?): Boolean = node == null || node.isNull || node.isMissingNode

    // ── Map retrieval ────────────────────────────────────────────────────────

    @Test
    fun `GET maps returns 200`() {
        assertEquals(200, get("/api/sessions").statusCode())
    }

    @Test
    fun `GET map by id returns 200`() {
        val response = get("/api/sessions/$mapId")
        assertEquals(200, response.statusCode())
        assertEquals(mapId.toString(), json(response)["id"].asText())
    }

    @Test
    fun `GET map with unknown id returns 404`() {
        assertEquals(404, get("/api/sessions/${UUID.randomUUID()}").statusCode())
    }

    @Test
    fun `GET export returns 200 for collaborators`() {
        val response = get("/api/sessions/$mapId/export")
        assertEquals(200, response.statusCode())
        assertEquals(
            "attachment; filename=\"session-$mapId.json\"",
            response.headers().firstValue("Content-Disposition").orElse(null)
        )
        assertEquals(mapId.toString(), json(response)["id"].asText())
    }

    @Test
    fun `GET export returns 403 for viewers`() {
        assertEquals(403, get("/api/sessions/$mapId/export", bearer = viewerToken).statusCode())
    }

    // ── Landmarks ──────────────────────────────────────────────────────────────

    @Test
    fun `POST landmark places landmark and returns 200`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Iron Keep", "type" to "KEEP")
        val response = post("/api/sessions/$mapId/landmarks", body)
        assertEquals(200, response.statusCode())

        val state = sessionStatePort.findById(mapId)!!
        val lm = state.landmarks.values.first { it.name == "Iron Keep" }
        assertEquals("Iron Keep", json(response)["landmarks"][lm.id.toString()]["name"].asText())
    }

    @Test
    fun `POST landmark with unknown type returns 400`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Test", "type" to "DRAGON_LAIR")
        assertEquals(400, post("/api/sessions/$mapId/landmarks", body).statusCode())
    }

    @Test
    fun `POST landmark with removed WELL type returns 400`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Old Well", "type" to "WELL")
        assertEquals(400, post("/api/sessions/$mapId/landmarks", body).statusCode())
    }

    @Test
    fun `POST landmark with DEPRECATED_WELL type returns 400`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Old Well", "type" to "DEPRECATED_WELL")
        assertEquals(400, post("/api/sessions/$mapId/landmarks", body).statusCode())
    }

    @Test
    fun `POST unpositioned landmark with null groupId creates landmark without group`() {
        val body = mapOf(
            "name" to "Floating Tower",
            "type" to "KEEP",
            "description" to "Awaiting placement",
            "groupId" to null,
            "link" to null,
        )
        assertEquals(200, post("/api/sessions/$mapId/landmarks/unpositioned", body).statusCode())

        val landmark = sessionStatePort.findById(mapId)!!.landmarks.values.first { it.name == "Floating Tower" }
        assertNull(landmark.coordinate)
        assertNull(landmark.groupId)
    }

    @Test
    fun `POST unpositioned landmark with groupId assigns group`() {
        val groupId = UUID.randomUUID()
        val state = sessionStatePort.findById(mapId)!!
        state.groups[groupId] = LandmarkGroup(groupId, "Ops", "#00ffcc")
        sessionStatePort.save(state)

        val body = mapOf(
            "name" to "Ops Buffer",
            "type" to "KEEP",
            "description" to "Staged for planning",
            "groupId" to groupId.toString(),
            "link" to "https://example.test/ops-buffer",
        )
        assertEquals(200, post("/api/sessions/$mapId/landmarks/unpositioned", body).statusCode())

        val landmark = sessionStatePort.findById(mapId)!!.landmarks.values.first { it.name == "Ops Buffer" }
        assertEquals(groupId, landmark.groupId)
        assertEquals("https://example.test/ops-buffer", landmark.link)
        assertNull(landmark.coordinate)
    }

    @Test
    fun `DELETE landmark removes it`() {
        val lmId = UUID.nameUUIDFromBytes("my-tower".toByteArray())
        val state = sessionStatePort.findById(mapId)!!
        state.landmarks[lmId] = Landmark(id = lmId, name = "My Tower", coordinate = HexCoordinate(1, 0))
        sessionStatePort.save(state)

        assertEquals(200, delete("/api/sessions/$mapId/landmarks/$lmId").statusCode())
    }

    // ── Tiles ──────────────────────────────────────────────────────────────────

    @Test
    fun `PATCH tile changes elevation`() {
        val body = mapOf("elevation" to 4, "terrain" to null)
        assertEquals(200, patch("/api/sessions/$mapId/tiles/0/0", body).statusCode())
    }

    @Test
    fun `PATCH tile with unknown terrain returns 400`() {
        val body = mapOf("elevation" to null, "terrain" to "LAVA")
        assertEquals(400, patch("/api/sessions/$mapId/tiles/0/0", body).statusCode())
    }

    // ── Groups ─────────────────────────────────────────────────────────────────

    @Test
    fun `POST group creates group`() {
        val body = mapOf("name" to "Alpha Team", "color" to "#ff0000")
        assertEquals(200, post("/api/sessions/$mapId/groups", body).statusCode())
    }

    // ── Map editing ────────────────────────────────────────────────────────────

    @Test
    fun `PATCH map sets name and description`() {
        val body = mapOf("name" to "My Campaign", "description" to "A great adventure")
        val response = patch("/api/sessions/$mapId", body)
        assertEquals(200, response.statusCode())
        val tree = json(response)
        assertEquals("My Campaign", tree["name"].asText())
        assertEquals("A great adventure", tree["description"].asText())
    }

    @Test
    fun `PATCH map with null description clears it`() {
        sessionStatePort.save(
            sessionStatePort.findById(mapId)!!.copy(name = "Old Name", description = "Old Desc")
        )
        val body = mapOf("name" to "New Name", "description" to null)
        val response = patch("/api/sessions/$mapId", body)
        assertEquals(200, response.statusCode())
        val tree = json(response)
        assertEquals("New Name", tree["name"].asText())
        assertTrue(isNullOrMissing(tree["description"]))
    }

    @Test
    fun `PATCH map with blank name stores null`() {
        val body = mapOf("name" to "   ", "description" to null)
        val response = patch("/api/sessions/$mapId", body)
        assertEquals(200, response.statusCode())
        assertTrue(isNullOrMissing(json(response)["name"]))
    }

    // ── Quality metrics ────────────────────────────────────────────────────────

    @Test
    fun `POST metric creates metric and returns 200`() {
        val body = mapOf("name" to "Availability", "description" to "Uptime percentage")
        val response = post("/api/sessions/$mapId/metrics", body)
        assertEquals(200, response.statusCode())
        assertTrue(json(response)["metrics"].size() > 0)
    }

    @Test
    fun `PATCH metric updates name`() {
        val createBody = mapOf("name" to "Latency", "description" to "Response time")
        val createResponse = post("/api/sessions/$mapId/metrics", createBody)
        assertEquals(200, createResponse.statusCode())
        val metricId = json(createResponse)["metrics"].propertyNames().first()

        val editBody = mapOf("name" to "P99 Latency", "description" to null)
        assertEquals(200, patch("/api/sessions/$mapId/metrics/$metricId", editBody).statusCode())
    }

    @Test
    fun `DELETE metric removes it`() {
        val createBody = mapOf("name" to "Error Rate", "description" to "Errors per second")
        val createResponse = post("/api/sessions/$mapId/metrics", createBody)
        assertEquals(200, createResponse.statusCode())
        val metricId = json(createResponse)["metrics"].propertyNames().first()

        val response = delete("/api/sessions/$mapId/metrics/$metricId")
        assertEquals(200, response.statusCode())
        assertEquals(0, json(response)["metrics"].size())
    }

    @Test
    fun `PUT landmark metric sets entry and returns 200`() {
        val lmId = UUID.nameUUIDFromBytes("guard-tower".toByteArray())
        val state = sessionStatePort.findById(mapId)!!
        state.landmarks[lmId] = Landmark(id = lmId, name = "Guard Tower", coordinate = HexCoordinate(0, 0))
        sessionStatePort.save(state)

        val metricBody = mapOf("name" to "Availability", "description" to "Uptime")
        val metricResponse = post("/api/sessions/$mapId/metrics", metricBody)
        assertEquals(200, metricResponse.statusCode())
        val metricId = json(metricResponse)["metrics"].propertyNames().first()

        val entryBody = mapOf("value" to null, "level" to "NONE", "link" to "https://example.com/report", "linkText" to "Report")
        val response = put("/api/sessions/$mapId/landmarks/$lmId/metrics/$metricId", entryBody)
        assertEquals(200, response.statusCode())
        val entry = json(response)["landmarks"][lmId.toString()]["metrics"][metricId]
        assertEquals("https://example.com/report", entry["link"].stringValue())
        assertEquals("Report", entry["linkText"].stringValue())
    }

    @Test
    fun `PUT landmark metric with unknown level returns 400`() {
        val lmId = UUID.nameUUIDFromBytes("beacon".toByteArray())
        val state = sessionStatePort.findById(mapId)!!
        state.landmarks[lmId] = Landmark(id = lmId, name = "Beacon", coordinate = HexCoordinate(1, 1))
        sessionStatePort.save(state)

        val metricBody = mapOf("name" to "SLA", "description" to "Service level")
        val metricResponse = post("/api/sessions/$mapId/metrics", metricBody)
        val metricId = json(metricResponse)["metrics"].propertyNames().first()

        val entryBody = mapOf("value" to "99 %", "level" to "CRITICAL")
        assertEquals(400, put("/api/sessions/$mapId/landmarks/$lmId/metrics/$metricId", entryBody).statusCode())
    }

    @Test
    fun `DELETE landmark metric clears entry`() {
        val lmId = UUID.nameUUIDFromBytes("scout-post".toByteArray())
        val state = sessionStatePort.findById(mapId)!!
        state.landmarks[lmId] = Landmark(id = lmId, name = "Scout Post", coordinate = HexCoordinate(0, 1))
        sessionStatePort.save(state)

        val metricBody = mapOf("name" to "Health", "description" to "Health check")
        val metricResponse = post("/api/sessions/$mapId/metrics", metricBody)
        val metricId = json(metricResponse)["metrics"].propertyNames().first()

        assertEquals(200, put("/api/sessions/$mapId/landmarks/$lmId/metrics/$metricId", mapOf("value" to "ok", "level" to "OK")).statusCode())
        assertEquals(200, delete("/api/sessions/$mapId/landmarks/$lmId/metrics/$metricId").statusCode())
    }

    // ── POST /api/sessions – mapType and mapSize ───────────────────────────────

    @Test
    fun `POST maps with no body creates LAND MEDIUM map`() {
        val response = post("/api/sessions")
        assertEquals(200, response.statusCode())
        val tiles = json(response)["map"]["tiles"]
        assertEquals(2500, tiles.size())
    }

    @Test
    fun `POST maps with BLANK type creates all-grass map`() {
        val body = mapOf("mapType" to "BLANK", "mapSize" to "SMALL")
        val response = post("/api/sessions", body)
        assertEquals(200, response.statusCode())
        val tiles = json(response)["map"]["tiles"]
        assertEquals(625, tiles.size())
        tiles.forEach { tile -> assertEquals("GRASS", tile["terrain"].asText()) }
    }

    @Test
    fun `POST maps with SMALL size creates 625-tile map`() {
        val body = mapOf("mapType" to "LAND", "mapSize" to "SMALL")
        val response = post("/api/sessions", body)
        assertEquals(200, response.statusCode())
        assertEquals(625, json(response)["map"]["tiles"].size())
    }

    @Test
    fun `POST maps with MEDIUM size creates 2500-tile map`() {
        val body = mapOf("mapType" to "BLANK", "mapSize" to "MEDIUM")
        val response = post("/api/sessions", body)
        assertEquals(200, response.statusCode())
        assertEquals(2500, json(response)["map"]["tiles"].size())
    }

    @Test
    fun `POST maps with LARGE size creates 6400-tile map`() {
        val body = mapOf("mapType" to "BLANK", "mapSize" to "LARGE")
        val response = post("/api/sessions", body)
        assertEquals(200, response.statusCode())
        assertEquals(6400, json(response)["map"]["tiles"].size())
    }

    @Test
    fun `POST maps with SEA type creates mostly-water map`() {
        val body = mapOf("mapType" to "SEA", "mapSize" to "SMALL")
        val response = post("/api/sessions", body)
        assertEquals(200, response.statusCode())
        val tiles = json(response)["map"]["tiles"]
        val waterCount = tiles.count { it["terrain"].asText() == "WATER" }
        assertTrue(waterCount > tiles.size() / 2, "Sea map should be mostly water")
    }

    // ── Unauthenticated access ─────────────────────────────────────────────────

    @Test
    fun `unauthenticated request returns 401 or 403`() {
        val status = get("/api/sessions", bearer = null).statusCode()
        assertTrue(status == 401 || status == 403) { "Expected 401 or 403 but got $status" }
    }

    @Test
    fun `PATCH map unauthenticated returns 401 or 403`() {
        val body = mapOf("name" to "Hacked", "description" to null)
        val status = patch("/api/sessions/$mapId", body, bearer = null).statusCode()
        assertTrue(status == 401 || status == 403) { "Expected 401 or 403 but got $status" }
    }

    @Test
    fun `POST maps unauthenticated returns 401 or 403`() {
        val body = mapOf("mapType" to "BLANK", "mapSize" to "SMALL")
        val status = post("/api/sessions", body, bearer = null).statusCode()
        assertTrue(status == 401 || status == 403)
    }
}
