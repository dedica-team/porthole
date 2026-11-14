package team.dedica.porthole.adapter.`in`.web

import io.micronaut.runtime.server.EmbeddedServer
import io.micronaut.test.extensions.junit5.annotation.MicronautTest
import jakarta.inject.Inject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.`in`.web.dto.ShootRequest
import team.dedica.porthole.adapter.`in`.web.security.JwtTokenProvider
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.Bug
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.GameGeometry
import team.dedica.porthole.domain.GamePhase
import team.dedica.porthole.domain.GameState
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.Landmark
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.SessionState
import tools.jackson.databind.ObjectMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

@MicronautTest
class GameControllerTest {

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
    private lateinit var outsiderToken: String
    private lateinit var sessionId: UUID
    private lateinit var towerId: UUID

    private val http: HttpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .build()

    @BeforeEach
    fun setup() {
        if (userPort.findByUsername("player1") == null) {
            userPort.save(
                UserRecord(
                    id = UUID.nameUUIDFromBytes("test-player1".toByteArray()),
                    username = "player1",
                    githubId = "gh-player1"
                )
            )
        }
        val user = userPort.findByUsername("player1")!!
        token = jwtTokenProvider.generateToken(user.id, user.username)

        if (userPort.findByUsername("player2") == null) {
            userPort.save(
                UserRecord(
                    id = UUID.nameUUIDFromBytes("test-player2".toByteArray()),
                    username = "player2",
                    githubId = "gh-player2"
                )
            )
        }
        val outsider = userPort.findByUsername("player2")!!
        outsiderToken = jwtTokenProvider.generateToken(outsider.id, outsider.username)

        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 1 })
        val tower = Landmark(
            id = UUID.randomUUID(),
            name = "Watchtower",
            coordinate = HexCoordinate(0, 0),
            type = LandmarkType.WATCHTOWER,
        )
        towerId = tower.id

        val state = SessionState(map = map, gameEnabled = true).also {
            it.collaborators.add(Collaborator(id = user.id, username = user.username))
            it.landmarks[tower.id] = tower
            it.gameState = GameState(phase = GamePhase.ACTIVE)
        }
        sessionStatePort.save(state)
        sessionId = state.id
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

    @Test
    fun `GET game state returns active state for collaborator`() {
        val response = send("GET", "/api/sessions/$sessionId/game")
        assertEquals(200, response.statusCode())
        val node = objectMapper.readTree(response.body())
        assertEquals("ACTIVE", node.get("phase").asString())
    }

    @Test
    fun `collaborator can enter and leave watchtower`() {
        val enterResponse = send("POST", "/api/sessions/$sessionId/game/watchtower/$towerId/enter")
        assertEquals(200, enterResponse.statusCode())

        val stateAfterEnter = sessionStatePort.findById(sessionId)!!
        val user = userPort.findByUsername("player1")!!
        assertEquals(user.id, stateAfterEnter.gameState.towerOccupants[towerId])

        val leaveResponse = send("POST", "/api/sessions/$sessionId/game/watchtower/$towerId/leave")
        assertEquals(200, leaveResponse.statusCode())

        val stateAfterLeave = sessionStatePort.findById(sessionId)!!
        assertFalse(stateAfterLeave.gameState.towerOccupants.containsKey(towerId))
    }

    @Test
    fun `outsider is denied entry to watchtower`() {
        val enterResponse = send("POST", "/api/sessions/$sessionId/game/watchtower/$towerId/enter", bearer = outsiderToken)
        assertEquals(403, enterResponse.statusCode())
    }

    @Test
    fun `collaborator in watchtower can shoot and hit a bug`() {
        val user = userPort.findByUsername("player1")!!
        val bug = Bug(coordinate = HexCoordinate(1, 0))
        val state = sessionStatePort.findById(sessionId)!!
        state.gameState.towerOccupants[towerId] = user.id
        state.gameState.bugs[bug.id] = bug
        sessionStatePort.save(state)

        val tower = state.landmarks[towerId]!!
        val origin = GameGeometry.towerEyePosition(state, tower)!!
        val target = GameGeometry.bugPosition(state, bug)
        val dir = (target - origin).normalized()!!

        val request = ShootRequest(
            originX = origin.x,
            originY = origin.y,
            originZ = origin.z,
            dirX = dir.x,
            dirY = dir.y,
            dirZ = dir.z,
        )

        val response = send("POST", "/api/sessions/$sessionId/game/shoot", body = request)
        assertEquals(200, response.statusCode())
        val node = objectMapper.readTree(response.body())
        assertTrue(node.get("hit").asBoolean())
        assertEquals(bug.id.toString(), node.get("bugId").asString())
    }
}
