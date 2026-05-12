package team.dedica.porthole.adapter.`in`.web

import java.util.UUID

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import team.dedica.porthole.adapter.`in`.web.security.JwtTokenProvider
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.domain.*
import org.springframework.test.context.ContextConfiguration
import team.dedica.porthole.TestStorageCleaner

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test", "dev")
@ContextConfiguration(initializers = [TestStorageCleaner::class])
class SessionControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc
    @Autowired
    lateinit var objectMapper: ObjectMapper
    @Autowired
    lateinit var jwtTokenProvider: JwtTokenProvider
    @Autowired
    lateinit var sessionStatePort: SessionStatePort
    @Autowired
    lateinit var userPort: UserPort

    private lateinit var token: String
    private lateinit var mapId: UUID

    @BeforeEach
    fun setup() {
        // Ensure test user exists
        if (userPort.findByUsername("testuser") == null) {
            userPort.save(
                UserRecord(
                    id = UUID.nameUUIDFromBytes("test-uid-001".toByteArray()),
                    username = "testuser",
                    githubId = "gh-test"
                )
            )
        }
        val user = userPort.findByUsername("testuser")!!
        token = jwtTokenProvider.generateToken(user.id, user.username)

        // Create a fresh map for each test
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        val state = SessionState(map = map).also {
            it.collaborators.add(Collaborator(id = user.id, username = user.username))
        }
        sessionStatePort.save(state)
        mapId = state.id
    }

    @Test
    fun `GET maps returns 200`() {
        mockMvc.perform(get("/api/sessions").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
    }

    @Test
    fun `GET map by id returns 200`() {
        mockMvc.perform(get("/api/sessions/$mapId").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(mapId.toString()))
    }

    @Test
    fun `GET map with unknown id returns 404`() {
        mockMvc.perform(get("/api/sessions/" + UUID.randomUUID()).header("Authorization", "Bearer $token"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `POST landmark places landmark and returns 200`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Iron Keep", "type" to "KEEP")
        val result = mockMvc.perform(
            post("/api/sessions/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
            .andReturn()
        val state = sessionStatePort.findById(mapId)!!
        val lm = state.landmarks.values.first { it.name == "Iron Keep" }
        val key = lm.id.toString()
        val tree = objectMapper.readTree(result.response.contentAsString)
        assertEquals("Iron Keep", tree["landmarks"][key]["name"].asText())
    }

    @Test
    fun `POST landmark with unknown type returns 400`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Test", "type" to "DRAGON_LAIR")
        mockMvc.perform(
            post("/api/sessions/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `POST landmark with removed WELL type returns 400`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Old Well", "type" to "WELL")
        mockMvc.perform(
            post("/api/sessions/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `POST landmark with DEPRECATED_WELL type returns 400`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Old Well", "type" to "DEPRECATED_WELL")
        mockMvc.perform(
            post("/api/sessions/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isBadRequest)
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

        mockMvc.perform(
            post("/api/sessions/$mapId/landmarks/unpositioned")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)

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

        mockMvc.perform(
            post("/api/sessions/$mapId/landmarks/unpositioned")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)

        val landmark = sessionStatePort.findById(mapId)!!.landmarks.values.first { it.name == "Ops Buffer" }
        assertEquals(groupId, landmark.groupId)
        assertEquals("https://example.test/ops-buffer", landmark.link)
        assertNull(landmark.coordinate)
    }

    @Test
    fun `PATCH tile changes elevation`() {
        val body = mapOf("elevation" to 4, "terrain" to null)
        mockMvc.perform(
            patch("/api/sessions/$mapId/tiles/0/0")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
    }

    @Test
    fun `PATCH tile with unknown terrain returns 400`() {
        val body = mapOf("elevation" to null, "terrain" to "LAVA")
        mockMvc.perform(
            patch("/api/sessions/$mapId/tiles/0/0")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `POST group creates group`() {
        val body = mapOf("name" to "Alpha Team", "color" to "#ff0000")
        mockMvc.perform(
            post("/api/sessions/$mapId/groups")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
    }

    @Test
    fun `unauthenticated request returns 401 or 403`() {
        val status = mockMvc.perform(get("/api/sessions"))
            .andReturn().response.status
        assertTrue(status == 401 || status == 403) { "Expected 401 or 403 but got $status" }
    }

    @Test
    fun `DELETE landmark removes it`() {
        // Insert landmark directly into the store with a known UUID
        val lmId = UUID.nameUUIDFromBytes("my-tower".toByteArray())
        val state = sessionStatePort.findById(mapId)!!
        state.landmarks[lmId] = Landmark(id = lmId, name = "My Tower", coordinate = HexCoordinate(1, 0))
        sessionStatePort.save(state)

        mockMvc.perform(
            delete("/api/sessions/$mapId/landmarks/$lmId")
                .header("Authorization", "Bearer $token")
        ).andExpect(status().isOk)
    }

    @Test
    fun `PATCH map sets name and description`() {
        val body = mapOf("name" to "My Campaign", "description" to "A great adventure")
        mockMvc.perform(
            patch("/api/sessions/$mapId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.name").value("My Campaign"))
            .andExpect(jsonPath("$.description").value("A great adventure"))
    }

    @Test
    fun `PATCH map with null description clears it`() {
        // Set initial values
        sessionStatePort.save(
            sessionStatePort.findById(mapId)!!.copy(name = "Old Name", description = "Old Desc")
        )
        val body = mapOf("name" to "New Name", "description" to null)
        mockMvc.perform(
            patch("/api/sessions/$mapId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.name").value("New Name"))
            .andExpect(jsonPath("$.description").doesNotExist())
    }

    @Test
    fun `PATCH map with blank name stores null`() {
        val body = mapOf("name" to "   ", "description" to null)
        mockMvc.perform(
            patch("/api/sessions/$mapId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.name").doesNotExist())
    }

    @Test
    fun `PATCH map unauthenticated returns 401 or 403`() {
        val body = mapOf("name" to "Hacked", "description" to null)
        val status = mockMvc.perform(
            patch("/api/sessions/$mapId")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andReturn().response.status
        assertTrue(status == 401 || status == 403) { "Expected 401 or 403 but got $status" }
    }

    // ── Quality Metrics ────────────────────────────────────────────────────────

    @Test
    fun `POST metric creates metric and returns 200`() {
        val body = mapOf("name" to "Availability", "description" to "Uptime percentage")
        mockMvc.perform(
            post("/api/sessions/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.metrics").isNotEmpty)
    }

    @Test
    fun `PATCH metric updates name`() {
        // create
        val createBody = mapOf("name" to "Latency", "description" to "Response time")
        val createResult = mockMvc.perform(
            post("/api/sessions/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createBody))
        ).andExpect(status().isOk).andReturn()
        val tree = objectMapper.readTree(createResult.response.contentAsString)
        val metricId = tree["metrics"].fieldNames().next()

        val editBody = mapOf("name" to "P99 Latency", "description" to null)
        mockMvc.perform(
            patch("/api/sessions/$mapId/metrics/$metricId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(editBody))
        ).andExpect(status().isOk)
    }

    @Test
    fun `DELETE metric removes it`() {
        // create
        val createBody = mapOf("name" to "Error Rate", "description" to "Errors per second")
        val createResult = mockMvc.perform(
            post("/api/sessions/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createBody))
        ).andExpect(status().isOk).andReturn()
        val tree = objectMapper.readTree(createResult.response.contentAsString)
        val metricId = tree["metrics"].fieldNames().next()

        mockMvc.perform(
            delete("/api/sessions/$mapId/metrics/$metricId")
                .header("Authorization", "Bearer $token")
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.metrics").isEmpty)
    }

    @Test
    fun `PUT landmark metric sets entry and returns 200`() {
        // Insert landmark directly into the store with a known UUID
        val lmId = UUID.nameUUIDFromBytes("guard-tower".toByteArray())
        val state = sessionStatePort.findById(mapId)!!
        state.landmarks[lmId] = Landmark(id = lmId, name = "Guard Tower", coordinate = HexCoordinate(0, 0))
        sessionStatePort.save(state)

        // create metric
        val metricBody = mapOf("name" to "Availability", "description" to "Uptime")
        val metricResult = mockMvc.perform(
            post("/api/sessions/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(metricBody))
        ).andExpect(status().isOk).andReturn()
        val metricId = objectMapper.readTree(metricResult.response.contentAsString)["metrics"].fieldNames().next()

        // set landmark metric
        val entryBody = mapOf("value" to null, "level" to "NONE", "link" to "https://example.com/report", "linkText" to "Report")
        mockMvc.perform(
            put("/api/sessions/$mapId/landmarks/$lmId/metrics/$metricId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(entryBody))
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.landmarks.$lmId.metrics.$metricId.link").value("https://example.com/report"))
            .andExpect(jsonPath("$.landmarks.$lmId.metrics.$metricId.linkText").value("Report"))
    }

    @Test
    fun `PUT landmark metric with unknown level returns 400`() {
        // Insert landmark directly into the store with a known UUID
        val lmId = UUID.nameUUIDFromBytes("beacon".toByteArray())
        val state = sessionStatePort.findById(mapId)!!
        state.landmarks[lmId] = Landmark(id = lmId, name = "Beacon", coordinate = HexCoordinate(1, 1))
        sessionStatePort.save(state)

        val metricBody = mapOf("name" to "SLA", "description" to "Service level")
        val metricResult = mockMvc.perform(
            post("/api/sessions/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(metricBody))
        ).andReturn()
        val metricId = objectMapper.readTree(metricResult.response.contentAsString)["metrics"].fieldNames().next()

        val entryBody = mapOf("value" to "99 %", "level" to "CRITICAL")
        mockMvc.perform(
            put("/api/sessions/$mapId/landmarks/$lmId/metrics/$metricId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(entryBody))
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `DELETE landmark metric clears entry`() {
        // Insert landmark directly into the store with a known UUID
        val lmId = UUID.nameUUIDFromBytes("scout-post".toByteArray())
        val state = sessionStatePort.findById(mapId)!!
        state.landmarks[lmId] = Landmark(id = lmId, name = "Scout Post", coordinate = HexCoordinate(0, 1))
        sessionStatePort.save(state)

        // create + assign metric
        val metricBody = mapOf("name" to "Health", "description" to "Health check")
        val metricResult = mockMvc.perform(
            post("/api/sessions/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(metricBody))
        ).andReturn()
        val metricId = objectMapper.readTree(metricResult.response.contentAsString)["metrics"].fieldNames().next()

        mockMvc.perform(
            put("/api/sessions/$mapId/landmarks/$lmId/metrics/$metricId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(mapOf("value" to "ok", "level" to "OK")))
        ).andExpect(status().isOk)

        // clear
        mockMvc.perform(
            delete("/api/sessions/$mapId/landmarks/$lmId/metrics/$metricId")
                .header("Authorization", "Bearer $token")
        ).andExpect(status().isOk)
    }

    // ── POST /api/sessions – mapType and mapSize ──────────────────────────────────

    @Test
    fun `POST maps with no body creates LAND MEDIUM map`() {
        val result = mockMvc.perform(
            post("/api/sessions")
                .header("Authorization", "Bearer $token")
        ).andExpect(status().isOk)
            .andReturn()
        val tiles = objectMapper.readTree(result.response.contentAsString)["map"]["tiles"]
        assertEquals(2500, tiles.size())
    }

    @Test
    fun `POST maps with BLANK type creates all-grass map`() {
        val body = mapOf("mapType" to "BLANK", "mapSize" to "SMALL")
        val result = mockMvc.perform(
            post("/api/sessions")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
            .andReturn()
        val tiles = objectMapper.readTree(result.response.contentAsString)["map"]["tiles"]
        assertEquals(625, tiles.size())
        tiles.forEach { tile ->
            assertEquals("GRASS", tile["terrain"].asText())
        }
    }

    @Test
    fun `POST maps with SMALL size creates 625-tile map`() {
        val body = mapOf("mapType" to "LAND", "mapSize" to "SMALL")
        val result = mockMvc.perform(
            post("/api/sessions")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
            .andReturn()
        val tiles = objectMapper.readTree(result.response.contentAsString)["map"]["tiles"]
        assertEquals(625, tiles.size())
    }

    @Test
    fun `POST maps with MEDIUM size creates 2500-tile map`() {
        val body = mapOf("mapType" to "BLANK", "mapSize" to "MEDIUM")
        val result = mockMvc.perform(
            post("/api/sessions")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
            .andReturn()
        val tiles = objectMapper.readTree(result.response.contentAsString)["map"]["tiles"]
        assertEquals(2500, tiles.size())
    }

    @Test
    fun `POST maps with LARGE size creates 6400-tile map`() {
        val body = mapOf("mapType" to "BLANK", "mapSize" to "LARGE")
        val result = mockMvc.perform(
            post("/api/sessions")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
            .andReturn()
        val tiles = objectMapper.readTree(result.response.contentAsString)["map"]["tiles"]
        assertEquals(6400, tiles.size())
    }

    @Test
    fun `POST maps with SEA type creates mostly-water map`() {
        val body = mapOf("mapType" to "SEA", "mapSize" to "SMALL")
        val result = mockMvc.perform(
            post("/api/sessions")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
            .andReturn()
        val tiles = objectMapper.readTree(result.response.contentAsString)["map"]["tiles"]
        val waterCount = tiles.count { it["terrain"].asText() == "WATER" }
        assertTrue(waterCount > tiles.size() / 2, "Sea map should be mostly water")
    }

    @Test
    fun `POST maps unauthenticated returns 401 or 403`() {
        val body = mapOf("mapType" to "BLANK", "mapSize" to "SMALL")
        val status = mockMvc.perform(
            post("/api/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andReturn().response.status
        assertTrue(status == 401 || status == 403)
    }
}

