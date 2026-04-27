package team.dedica.porthole.adapter.`in`.web

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
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
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.domain.*
import org.springframework.test.context.ContextConfiguration
import team.dedica.porthole.TestStorageCleaner

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test", "dev")
@ContextConfiguration(initializers = [TestStorageCleaner::class])
class MapControllerTest {

    @Autowired lateinit var mockMvc: MockMvc
    @Autowired lateinit var objectMapper: ObjectMapper
    @Autowired lateinit var jwtTokenProvider: JwtTokenProvider
    @Autowired lateinit var mapStatePort: MapStatePort
    @Autowired lateinit var userWritePort: UserWritePort

    private lateinit var token: String
    private lateinit var mapId: String

    @BeforeEach
    fun setup() {
        // Ensure test user exists
        if (userWritePort.findByUsername("testuser") == null) {
            userWritePort.save(UserRecord(id = "test-uid-001", username = "testuser", githubId = "gh-test"))
        }
        val user = userWritePort.findByUsername("testuser")!!
        token = jwtTokenProvider.generateToken(user.id, user.username)

        // Create a fresh map for each test
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        val state = MapState(map = map).also {
            it.collaborators.add(Collaborator(id = user.id, username = user.username))
        }
        mapStatePort.save(state)
        mapId = state.id
    }

    @Test
    fun `GET maps returns 200`() {
        mockMvc.perform(get("/api/maps").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
    }

    @Test
    fun `GET map by id returns 200`() {
        mockMvc.perform(get("/api/maps/$mapId").header("Authorization", "Bearer $token"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(mapId))
    }

    @Test
    fun `GET map with unknown id returns 404`() {
        mockMvc.perform(get("/api/maps/no-such-map").header("Authorization", "Bearer $token"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `POST landmark places landmark and returns 200`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Iron Keep", "type" to "KEEP")
        mockMvc.perform(
            post("/api/maps/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
         .andExpect(jsonPath("$.landmarks['iron-keep'].name").value("Iron Keep"))
    }

    @Test
    fun `POST landmark with unknown type returns 400`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Test", "type" to "DRAGON_LAIR")
        mockMvc.perform(
            post("/api/maps/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `POST landmark with removed WELL type returns 400`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Old Well", "type" to "WELL")
        mockMvc.perform(
            post("/api/maps/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `POST landmark with DEPRECATED_WELL type returns 400`() {
        val body = mapOf("q" to 0, "r" to 0, "name" to "Old Well", "type" to "DEPRECATED_WELL")
        mockMvc.perform(
            post("/api/maps/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `PATCH tile changes elevation`() {
        val body = mapOf("elevation" to 4, "terrain" to null)
        mockMvc.perform(
            patch("/api/maps/$mapId/tiles/0/0")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
    }

    @Test
    fun `PATCH tile with unknown terrain returns 400`() {
        val body = mapOf("elevation" to null, "terrain" to "LAVA")
        mockMvc.perform(
            patch("/api/maps/$mapId/tiles/0/0")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `POST group creates group`() {
        val body = mapOf("name" to "Alpha Team", "color" to "#ff0000")
        mockMvc.perform(
            post("/api/maps/$mapId/groups")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andExpect(status().isOk)
    }

    @Test
    fun `unauthenticated request returns 401 or 403`() {
        val status = mockMvc.perform(get("/api/maps"))
            .andReturn().response.status
        assertTrue(status == 401 || status == 403) { "Expected 401 or 403 but got $status" }
    }

    @Test
    fun `DELETE landmark removes it`() {
        // First place a landmark
        val placeBody = mapOf("q" to 1, "r" to 0, "name" to "My Tower", "type" to "KEEP")
        mockMvc.perform(
            post("/api/maps/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(placeBody))
        ).andExpect(status().isOk).andReturn()

        // Then delete it
        mockMvc.perform(
            delete("/api/maps/$mapId/landmarks/my-tower")
                .header("Authorization", "Bearer $token")
        ).andExpect(status().isOk)
    }

    @Test
    fun `PATCH map sets name and description`() {
        val body = mapOf("name" to "My Campaign", "description" to "A great adventure")
        mockMvc.perform(
            patch("/api/maps/$mapId")
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
        mapStatePort.save(
            mapStatePort.findById(mapId)!!.copy(name = "Old Name", description = "Old Desc")
        )
        val body = mapOf("name" to "New Name", "description" to null)
        mockMvc.perform(
            patch("/api/maps/$mapId")
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
            patch("/api/maps/$mapId")
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
            patch("/api/maps/$mapId")
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
            post("/api/maps/$mapId/metrics")
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
            post("/api/maps/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createBody))
        ).andExpect(status().isOk).andReturn()
        val tree = objectMapper.readTree(createResult.response.contentAsString)
        val metricId = tree["metrics"].fieldNames().next()

        val editBody = mapOf("name" to "P99 Latency", "description" to null)
        mockMvc.perform(
            patch("/api/maps/$mapId/metrics/$metricId")
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
            post("/api/maps/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createBody))
        ).andExpect(status().isOk).andReturn()
        val tree = objectMapper.readTree(createResult.response.contentAsString)
        val metricId = tree["metrics"].fieldNames().next()

        mockMvc.perform(
            delete("/api/maps/$mapId/metrics/$metricId")
                .header("Authorization", "Bearer $token")
        ).andExpect(status().isOk)
         .andExpect(jsonPath("$.metrics").isEmpty)
    }

    @Test
    fun `PUT landmark metric sets entry and returns 200`() {
        // place landmark
        val placeBody = mapOf("q" to 0, "r" to 0, "name" to "Guard Tower", "type" to "WATCHTOWER")
        mockMvc.perform(
            post("/api/maps/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(placeBody))
        ).andExpect(status().isOk)

        // create metric
        val metricBody = mapOf("name" to "Availability", "description" to "Uptime")
        val metricResult = mockMvc.perform(
            post("/api/maps/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(metricBody))
        ).andExpect(status().isOk).andReturn()
        val metricId = objectMapper.readTree(metricResult.response.contentAsString)["metrics"].fieldNames().next()

        // set landmark metric
        val entryBody = mapOf("value" to "99.9 %", "level" to "OK", "link" to null)
        mockMvc.perform(
            put("/api/maps/$mapId/landmarks/guard-tower/metrics/$metricId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(entryBody))
        ).andExpect(status().isOk)
    }

    @Test
    fun `PUT landmark metric with unknown level returns 400`() {
        // place landmark
        val placeBody = mapOf("q" to 1, "r" to 1, "name" to "Beacon", "type" to "LIGHTHOUSE")
        mockMvc.perform(
            post("/api/maps/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(placeBody))
        ).andExpect(status().isOk)

        val metricBody = mapOf("name" to "SLA", "description" to "Service level")
        val metricResult = mockMvc.perform(
            post("/api/maps/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(metricBody))
        ).andReturn()
        val metricId = objectMapper.readTree(metricResult.response.contentAsString)["metrics"].fieldNames().next()

        val entryBody = mapOf("value" to "99 %", "level" to "CRITICAL")
        mockMvc.perform(
            put("/api/maps/$mapId/landmarks/beacon/metrics/$metricId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(entryBody))
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `DELETE landmark metric clears entry`() {
        // place landmark
        val placeBody = mapOf("q" to 0, "r" to 1, "name" to "Scout Post", "type" to "WATCHTOWER")
        mockMvc.perform(
            post("/api/maps/$mapId/landmarks")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(placeBody))
        ).andExpect(status().isOk)

        // create + assign metric
        val metricBody = mapOf("name" to "Health", "description" to "Health check")
        val metricResult = mockMvc.perform(
            post("/api/maps/$mapId/metrics")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(metricBody))
        ).andReturn()
        val metricId = objectMapper.readTree(metricResult.response.contentAsString)["metrics"].fieldNames().next()

        mockMvc.perform(
            put("/api/maps/$mapId/landmarks/scout-post/metrics/$metricId")
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(mapOf("value" to "ok", "level" to "OK")))
        ).andExpect(status().isOk)

        // clear
        mockMvc.perform(
            delete("/api/maps/$mapId/landmarks/scout-post/metrics/$metricId")
                .header("Authorization", "Bearer $token")
        ).andExpect(status().isOk)
    }

    // ── POST /api/maps – mapType and mapSize ──────────────────────────────────

    @Test
    fun `POST maps with no body creates LAND MEDIUM map`() {
        val result = mockMvc.perform(
            post("/api/maps")
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
            post("/api/maps")
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
            post("/api/maps")
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
            post("/api/maps")
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
            post("/api/maps")
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
            post("/api/maps")
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
            post("/api/maps")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))
        ).andReturn().response.status
        assertTrue(status == 401 || status == 403)
    }
}

