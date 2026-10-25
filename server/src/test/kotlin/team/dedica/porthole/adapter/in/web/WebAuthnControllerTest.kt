package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.adapter.`in`.web.security.AuthCookieService
import team.dedica.porthole.adapter.`in`.web.security.JwtTokenProvider
import team.dedica.porthole.adapter.out.repository.PasskeyCredential
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.config.PortholeAuthPropertiesTestFactory
import java.time.Instant
import java.util.UUID

class WebAuthnControllerTest {

    private val userRepository = mock<UserPort>()
    private val jwtTokenProvider = mock<JwtTokenProvider>()
    private val props = PortholeAuthPropertiesTestFactory.withWebAuthn()
    private val authCookieService = AuthCookieService(props)
    private val adminService = AdminService("")
    private lateinit var controller: WebAuthnController

    @BeforeEach
    fun setUp() {
        controller = WebAuthnController(
            userRepository = userRepository,
            jwtTokenProvider = jwtTokenProvider,
            authCookieService = authCookieService,
            adminService = adminService,
            props = props,
        )
        whenever(jwtTokenProvider.generateToken(any(), any())).thenAnswer { "token-${it.arguments[1]}" }
    }

    private val HttpResponse<*>.code: Int get() = status.code

    private fun registerBody(response: HttpResponse<*>): RegisterStartResponse =
        response.body.get() as RegisterStartResponse

    private fun authBody(response: HttpResponse<*>): AuthStartResponse =
        response.body.get() as AuthStartResponse

    // ── register/start ────────────────────────────────────────────────────────

    @Test
    fun `register start returns 400 when username is blank`() {
        val response = controller.registerStart(RegisterStartRequest("   "))
        assertEquals(400, response.code)
    }

    @Test
    fun `register start returns 400 when username already taken`() {
        whenever(userRepository.findByUsername("alice"))
            .thenReturn(UserRecord(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "alice"))
        val response = controller.registerStart(RegisterStartRequest("alice"))
        assertEquals(400, response.code)
    }

    @Test
    fun `register start returns 400 for invalid username with special chars`() {
        val response = controller.registerStart(RegisterStartRequest("bob@evil"))
        assertEquals(400, response.code)
    }

    @Test
    fun `register start returns 400 for username with spaces`() {
        val response = controller.registerStart(RegisterStartRequest("bob smith"))
        assertEquals(400, response.code)
    }

    @Test
    fun `register start returns 400 for username exceeding max length`() {
        val long = "a".repeat(40)
        val response = controller.registerStart(RegisterStartRequest(long))
        assertEquals(400, response.code)
    }

    @Test
    fun `register start normalises username to lowercase`() {
        whenever(userRepository.findByUsername("bob")).thenReturn(null)
        val response = controller.registerStart(RegisterStartRequest("BoB"))
        assertEquals(200, response.code)
        assertEquals("bob", registerBody(response).user.name)
    }

    @Test
    fun `register start returns creation options with challenge and rp info`() {
        whenever(userRepository.findByUsername("bob")).thenReturn(null)
        val response = controller.registerStart(RegisterStartRequest("bob"))
        assertEquals(200, response.code)
        val body = registerBody(response)
        assertEquals("localhost", body.rp.id)
        assertEquals("Landmarks Test", body.rp.name)
        assertEquals("bob", body.user.name)
        assertTrue(body.challenge.isNotBlank())
        assertTrue(body.sessionId.isNotBlank())
        assertTrue(body.pubKeyCredParams.any { it.alg == -7 })   // ES256
        assertTrue(body.pubKeyCredParams.any { it.alg == -257 }) // RS256
        assertEquals("required", body.authenticatorSelection.residentKey)
    }

    @Test
    fun `register start stores pending challenge in cache`() {
        whenever(userRepository.findByUsername("carol")).thenReturn(null)
        val r1 = controller.registerStart(RegisterStartRequest("carol"))
        val r2 = controller.registerStart(RegisterStartRequest("carol"))
        // Two calls → two different session IDs
        assertNotEquals(registerBody(r1).sessionId, registerBody(r2).sessionId)
    }

    // ── register/finish ───────────────────────────────────────────────────────

    @Test
    fun `register finish returns 401 when session id unknown`() {
        val req = buildRegisterFinishRequest(sessionId = "unknown-session")
        val response = controller.registerFinish(req)
        assertEquals(401, response.code)
    }

    // ── authenticate/start ────────────────────────────────────────────────────

    @Test
    fun `auth start returns empty allowCredentials for discoverable flow`() {
        val response = controller.authStart(AuthStartRequest(username = null))
        assertEquals(200, response.code)
        assertTrue(authBody(response).allowCredentials.isEmpty())
    }

    @Test
    fun `auth start returns empty allowCredentials for known user with passkey to avoid enumeration`() {
        val cred = PasskeyCredential("cred-id-abc", "pk-cose", 0L, Instant.now().toString())
        whenever(userRepository.findByUsername("alice"))
            .thenReturn(UserRecord(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "alice", passkeyCredential = cred))
        val response = controller.authStart(AuthStartRequest(username = "alice"))
        assertEquals(200, response.code)
        assertTrue(authBody(response).allowCredentials.isEmpty())
    }

    @Test
    fun `auth start returns empty allowCredentials for user without passkey`() {
        whenever(userRepository.findByUsername("nokey"))
            .thenReturn(UserRecord(id = UUID.nameUUIDFromBytes("u2".toByteArray()), username = "nokey"))
        val response = controller.authStart(AuthStartRequest(username = "nokey"))
        assertEquals(200, response.code)
        assertTrue(authBody(response).allowCredentials.isEmpty())
    }

    @Test
    fun `auth start returns generic discoverable response for unknown username`() {
        whenever(userRepository.findByUsername("ghost")).thenReturn(null)
        val response = controller.authStart(AuthStartRequest(username = "ghost"))
        assertEquals(200, response.code)
        assertTrue(authBody(response).allowCredentials.isEmpty())
    }

    @Test
    fun `auth start returns 400 for invalid username`() {
        val response = controller.authStart(AuthStartRequest(username = "bad user"))
        assertEquals(400, response.code)
    }

    // ── authenticate/finish ───────────────────────────────────────────────────

    @Test
    fun `auth finish returns 401 when session id unknown`() {
        val req = buildAuthFinishRequest(sessionId = "unknown-session")
        val response = controller.authFinish(req)
        assertEquals(401, response.code)
    }

    // ── UserRecord model ──────────────────────────────────────────────────────

    @Test
    fun `UserRecord has null githubId by default`() {
        val user = UserRecord(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "passkey-only")
        assertNull(user.githubId)
    }

    @Test
    fun `UserRecord has null passkeyCredential by default`() {
        val user = UserRecord(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "alice", githubId = "gh-1")
        assertNull(user.passkeyCredential)
    }

    @Test
    fun `PasskeyCredential stores credentialId and signCount`() {
        val cred = PasskeyCredential("cred-xyz", "cose-key", 42L, Instant.now().toString())
        assertEquals("cred-xyz", cred.credentialId)
        assertEquals(42L, cred.signCount)
    }

    // ── USERNAME_PATTERN ─────────────────────────────────────────────────────

    @Test
    fun `username pattern accepts valid usernames`() {
        val pattern = WebAuthnController.USERNAME_PATTERN
        assertTrue(pattern.matches("a"))
        assertTrue(pattern.matches("alice"))
        assertTrue(pattern.matches("alice-bob"))
        assertTrue(pattern.matches("alice.bob"))
        assertTrue(pattern.matches("alice_bob"))
        assertTrue(pattern.matches("a1"))
        assertTrue(pattern.matches("user123"))
        assertTrue(pattern.matches("a".repeat(39)))
    }

    @Test
    fun `username pattern rejects invalid usernames`() {
        val pattern = WebAuthnController.USERNAME_PATTERN
        assertFalse(pattern.matches(""))
        assertFalse(pattern.matches("-alice"))         // starts with hyphen
        assertFalse(pattern.matches("alice-"))         // ends with hyphen
        assertFalse(pattern.matches(".alice"))          // starts with dot
        assertFalse(pattern.matches("alice."))          // ends with dot
        assertFalse(pattern.matches("a".repeat(40)))    // too long
        assertFalse(pattern.matches("alice bob"))       // space
        assertFalse(pattern.matches("alice@bob"))       // special char
        assertFalse(pattern.matches("<script>"))        // HTML
        assertFalse(pattern.matches("Alice"))           // uppercase (we lowercase before matching)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun buildRegisterFinishRequest(sessionId: String) = RegisterFinishRequest(
        sessionId = sessionId,
        id = "credential-id",
        rawId = "credential-id",
        attestationResponse = AttestationResponse(
            clientDataJSON = "",
            attestationObject = "",
        ),
        type = "public-key",
    )

    private fun buildAuthFinishRequest(sessionId: String) = AuthFinishRequest(
        sessionId = sessionId,
        id = "credential-id",
        rawId = "credential-id",
        assertionResponse = AssertionResponse(
            clientDataJSON = "",
            authenticatorData = "",
            signature = "",
            userHandle = null,
        ),
        type = "public-key",
    )
}
