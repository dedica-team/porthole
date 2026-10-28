package team.dedica.porthole.adapter.`in`.web

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
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
import team.dedica.porthole.domain.*
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

@MicronautTest
class GreenkeepingRotationControllerTest {

    @Inject
    lateinit var server: EmbeddedServer

    @Inject
    lateinit var jwtTokenProvider: JwtTokenProvider

    @Inject
    lateinit var sessionStatePort: SessionStatePort

    @Inject
    lateinit var userPort: UserPort

    private val objectMapper = JsonMapper.builder().addModule(kotlinModule()).build()

    private lateinit var token: String
    private lateinit var viewerToken: String
    private lateinit var user: UserRecord
    private lateinit var user2: UserRecord
    private lateinit var viewer: UserRecord
    private lateinit var mapId: UUID
    private lateinit var groupId: UUID

    private val http: HttpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .build()

    @BeforeEach
    fun setup() {
        val uid1 = UUID.nameUUIDFromBytes("test-gk-user-001".toByteArray())
        val uid2 = UUID.nameUUIDFromBytes("test-gk-user-002".toByteArray())
        val vUid = UUID.nameUUIDFromBytes("test-gk-viewer-001".toByteArray())

        userPort.save(UserRecord(id = uid1, username = "alice", githubId = "gh-alice"))
        userPort.save(UserRecord(id = uid2, username = "bob", githubId = "gh-bob"))
        userPort.save(UserRecord(id = vUid, username = "viewer", githubId = "gh-viewer"))

        user = userPort.findById(uid1)!!
        user2 = userPort.findById(uid2)!!
        viewer = userPort.findById(vUid)!!

        token = jwtTokenProvider.generateToken(user.id, user.username)
        viewerToken = jwtTokenProvider.generateToken(viewer.id, viewer.username)

        groupId = UUID.randomUUID()
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        val state = SessionState(map = map).also {
            it.collaborators.add(Collaborator(id = user.id, username = user.username))
            it.collaborators.add(Collaborator(id = user2.id, username = user2.username))
            it.groups[groupId] = LandmarkGroup(id = groupId, name = "Ops", color = "#00ffcc")
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

    // ── Tests ────────────────────────────────────────────────────────────────

    @Test
    fun `GET rotations returns empty list initially`() {
        val response = get("/api/sessions/$mapId/greenkeeping-rotations")
        assertEquals(200, response.statusCode())
        val list = json(response)
        assertTrue(list.isArray)
        assertEquals(0, list.size())
    }

    @Test
    fun `POST create rotation creates and returns rotation`() {
        val body = mapOf(
            "name" to "Weekly Infrastructure",
            "description" to "Duty cycle for infra checks",
            "link" to "https://example.com/infra",
            "groupIds" to listOf(groupId.toString()),
            "collaborators" to listOf(
                mapOf("collaboratorId" to user.id.toString()),
                mapOf("collaboratorId" to user2.id.toString()),
            ),
            "taskTemplates" to listOf(
                mapOf("title" to "Review Grafana dashboards"),
                mapOf("title" to "Check SSL certificate expiration"),
            ),
        )

        val response = post("/api/sessions/$mapId/greenkeeping-rotations", body)
        assertEquals(200, response.statusCode())
        val node = json(response)
        assertTrue(node.isArray)
        assertEquals(1, node.size())
        val rot = node[0]
        assertEquals("Weekly Infrastructure", rot["name"].asText())
        assertEquals("Duty cycle for infra checks", rot["description"].asText())
        assertEquals(2, rot["collaborators"].size())
        assertEquals(2, rot["taskTemplates"].size())
        assertEquals("Review Grafana dashboards", rot["taskTemplates"][0]["title"].asText())
    }

    @Test
    fun `PATCH rotation updates rotation properties`() {
        val state = sessionStatePort.findById(mapId)!!
        val rotId = UUID.randomUUID()
        val rotation = GreenkeepingRotation(
            id = rotId,
            name = "Initial Name",
            description = "Initial description",
            groupIds = mutableListOf(groupId),
        ).also {
            it.collaborators.add(GreenkeepingRotationCollaborator(collaboratorId = user.id))
        }
        state.greenkeepingRotations[rotId] = rotation
        sessionStatePort.save(state)

        val patchBody = mapOf(
            "name" to "Updated Name",
            "description" to "Updated description",
            "link" to "https://example.org/doc",
            "taskTemplates" to listOf(
                mapOf("title" to "New Template Task 1"),
            ),
        )

        val response = patch("/api/sessions/$mapId/greenkeeping-rotations/$rotId", patchBody)
        assertEquals(200, response.statusCode())
        val rot = json(response).first { it["id"].asText() == rotId.toString() }
        assertEquals("Updated Name", rot["name"].asText())
        assertEquals("Updated description", rot["description"].asText())
        assertEquals("https://example.org/doc", rot["link"].asText())
        assertEquals(1, rot["taskTemplates"].size())
        assertEquals("New Template Task 1", rot["taskTemplates"][0]["title"].asText())
    }

    @Test
    fun `DELETE rotation removes rotation from session`() {
        val state = sessionStatePort.findById(mapId)!!
        val rotId = UUID.randomUUID()
        val rotation = GreenkeepingRotation(id = rotId, name = "To Delete", groupIds = mutableListOf(groupId))
        state.greenkeepingRotations[rotId] = rotation
        sessionStatePort.save(state)

        val response = delete("/api/sessions/$mapId/greenkeeping-rotations/$rotId")
        assertEquals(204, response.statusCode())

        val updatedState = sessionStatePort.findById(mapId)!!
        assertFalse(updatedState.greenkeepingRotations.containsKey(rotId))
    }

    @Test
    fun `POST advance advances the active collaborator`() {
        val state = sessionStatePort.findById(mapId)!!
        val rotId = UUID.randomUUID()
        val rotation = GreenkeepingRotation(id = rotId, name = "Rotation Advance Test", groupIds = mutableListOf(groupId)).also {
            it.collaborators.add(GreenkeepingRotationCollaborator(collaboratorId = user.id, done = false))
            it.collaborators.add(GreenkeepingRotationCollaborator(collaboratorId = user2.id, done = false))
        }
        state.greenkeepingRotations[rotId] = rotation
        sessionStatePort.save(state)

        val response = post("/api/sessions/$mapId/greenkeeping-rotations/$rotId/advance")
        assertEquals(200, response.statusCode())
        val rot = json(response)
        assertEquals(rotId.toString(), rot["id"].asText())
        assertTrue(rot["collaborators"][0]["done"].asBoolean())
        assertFalse(rot["collaborators"][1]["done"].asBoolean())
    }

    @Test
    fun `Checklist lifecycle - start, update, finish, and discard`() {
        val state = sessionStatePort.findById(mapId)!!
        val rotId = UUID.randomUUID()
        val rotation = GreenkeepingRotation(id = rotId, name = "Rotation Checklist Lifecycle", groupIds = mutableListOf(groupId)).also {
            it.collaborators.add(GreenkeepingRotationCollaborator(collaboratorId = user.id))
            it.taskTemplates.add(GreenkeepingTaskTemplateItem(title = "Template Task A"))
            it.taskTemplates.add(GreenkeepingTaskTemplateItem(title = "Template Task B"))
        }
        state.greenkeepingRotations[rotId] = rotation
        sessionStatePort.save(state)

        // 1. Start Checklist
        val startResponse = post(
            "/api/sessions/$mapId/greenkeeping-rotations/$rotId/checklist",
            mapOf("title" to "2026-10-21 Checklist")
        )
        assertEquals(200, startResponse.statusCode())
        var rot = json(startResponse)
        assertEquals(rotId.toString(), rot["id"].asText())
        assertNotNull(rot["currentChecklist"])
        assertEquals("2026-10-21 Checklist", rot["currentChecklist"]["title"].asText())
        assertEquals(2, rot["currentChecklist"]["items"].size())
        val itemId1 = rot["currentChecklist"]["items"][0]["id"].asText()
        val itemId2 = rot["currentChecklist"]["items"][1]["id"].asText()

        // 2. Update Checklist
        val updateBody = mapOf(
            "title" to "Updated 2026-10-21 Checklist",
            "items" to listOf(
                mapOf(
                    "id" to itemId1,
                    "title" to "Template Task A (Checked)",
                    "done" to true,
                    "note" to "Executed without warnings"
                ),
                mapOf(
                    "id" to itemId2,
                    "title" to "Template Task B",
                    "done" to false,
                    "note" to null
                ),
            )
        )
        val updateResponse = put("/api/sessions/$mapId/greenkeeping-rotations/$rotId/checklist", updateBody)
        assertEquals(200, updateResponse.statusCode())
        rot = json(updateResponse)
        assertEquals(rotId.toString(), rot["id"].asText())
        assertEquals("Updated 2026-10-21 Checklist", rot["currentChecklist"]["title"].asText())
        assertTrue(rot["currentChecklist"]["items"][0]["done"].asBoolean())
        assertEquals("Executed without warnings", rot["currentChecklist"]["items"][0]["note"].asText())

        // 3. Finish Checklist
        val finishResponse = post("/api/sessions/$mapId/greenkeeping-rotations/$rotId/checklist/finish")
        assertEquals(200, finishResponse.statusCode())
        rot = json(finishResponse)
        assertEquals(rotId.toString(), rot["id"].asText())
        assertTrue(rot["currentChecklist"].isNull)
        assertEquals(1, rot["completedChecklists"].size())
        val completed = rot["completedChecklists"][0]
        assertEquals("Updated 2026-10-21 Checklist", completed["title"].asText())
        assertNotNull(completed["finishedAt"])
        assertEquals(user.id.toString(), completed["finishedBy"].asText())

        // 4. Start another checklist and Discard it
        post("/api/sessions/$mapId/greenkeeping-rotations/$rotId/checklist", mapOf("title" to "Temporary Checklist"))
        val discardResponse = delete("/api/sessions/$mapId/greenkeeping-rotations/$rotId/checklist")
        assertEquals(200, discardResponse.statusCode())
        rot = json(discardResponse)
        assertEquals(rotId.toString(), rot["id"].asText())
        assertTrue(rot["currentChecklist"].isNull)
        assertEquals(1, rot["completedChecklists"].size())
    }

    @Test
    fun `GET rotations without authentication returns 401 or 403`() {
        val response = get("/api/sessions/$mapId/greenkeeping-rotations", bearer = null)
        assertTrue(response.statusCode() == 401 || response.statusCode() == 403)
    }

    @Test
    fun `POST create rotation as viewer returns 403`() {
        val body = mapOf("name" to "Forbidden Rotation", "groupIds" to listOf(groupId.toString()))
        val response = post("/api/sessions/$mapId/greenkeeping-rotations", body, bearer = viewerToken)
        assertEquals(403, response.statusCode())
    }
}
