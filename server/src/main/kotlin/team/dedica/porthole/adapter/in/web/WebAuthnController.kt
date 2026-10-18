package team.dedica.porthole.adapter.`in`.web

import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.databind.ObjectMapper
import com.yubico.webauthn.FinishAssertionOptions
import com.yubico.webauthn.FinishRegistrationOptions
import com.yubico.webauthn.RelyingParty
import com.yubico.webauthn.StartAssertionOptions
import com.yubico.webauthn.StartRegistrationOptions
import com.yubico.webauthn.data.AuthenticatorAssertionResponse
import com.yubico.webauthn.data.AuthenticatorAttestationResponse
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria
import com.yubico.webauthn.data.ByteArray
import com.yubico.webauthn.data.ClientAssertionExtensionOutputs
import com.yubico.webauthn.data.ClientRegistrationExtensionOutputs
import com.yubico.webauthn.data.PublicKeyCredential
import com.yubico.webauthn.data.RelyingPartyIdentity
import com.yubico.webauthn.data.ResidentKeyRequirement
import com.yubico.webauthn.data.UserIdentity
import com.yubico.webauthn.data.UserVerificationRequirement
import org.slf4j.LoggerFactory
import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Post
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import team.dedica.porthole.adapter.`in`.web.security.AuthCookieService
import team.dedica.porthole.adapter.`in`.web.security.JwtTokenProvider
import team.dedica.porthole.config.PortholeAuthProperties
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.adapter.out.repository.PasskeyCredential
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.adapter.out.repository.YubicoCredentialRepository
import team.dedica.porthole.application.port.UserPort
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

// ── DTOs ─────────────────────────────────────────────────────────────────────

data class RegisterStartRequest(val username: String)

data class RegisterStartResponse(
    val sessionId: String,
    val challenge: String,
    val rp: RpInfo,
    val user: UserInfo,
    val pubKeyCredParams: List<PubKeyCredParam>,
    val authenticatorSelection: AuthenticatorSelection,
    val timeout: Long,
)

data class RpInfo(val id: String, val name: String)
data class UserInfo(val id: String, val name: String, val displayName: String)
data class PubKeyCredParam(val type: String, val alg: Int)
data class AuthenticatorSelection(
    val userVerification: String,
    val residentKey: String,
)

data class RegisterFinishRequest(
    val sessionId: String,
    val id: String,
    val rawId: String,
    @param:JsonProperty("response") val attestationResponse: AttestationResponse,
    val type: String,
)

data class AttestationResponse(
    val clientDataJSON: String,
    val attestationObject: String,
)

data class AuthStartRequest(val username: String? = null)

data class AuthStartResponse(
    val sessionId: String,
    val challenge: String,
    val allowCredentials: List<AllowCredential>,
    val userVerification: String,
    val timeout: Long,
)

data class AllowCredential(val type: String, val id: String)

data class AuthFinishRequest(
    val sessionId: String,
    val id: String,
    val rawId: String,
    @param:JsonProperty("response") val assertionResponse: AssertionResponse,
    val type: String,
)

data class AssertionResponse(
    val clientDataJSON: String,
    val authenticatorData: String,
    val signature: String,
    val userHandle: String? = null,
)

// ── Pending session cache ─────────────────────────────────────────────────────

private data class PendingRegistration(
    val options: com.yubico.webauthn.data.PublicKeyCredentialCreationOptions,
    val pendingUserId: UUID,
    val pendingUsername: String,
    val createdAt: Long = System.currentTimeMillis(),
)

private data class PendingAssertion(
    val request: com.yubico.webauthn.AssertionRequest,
    val expectedUsername: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)

private const val SESSION_TTL_MS = 5 * 60 * 1_000L

// ── Controller ────────────────────────────────────────────────────────────────

@Controller("/api/auth/webauthn")
class WebAuthnController(
    private val userRepository: UserPort,
    private val jwtTokenProvider: JwtTokenProvider,
    private val authCookieService: AuthCookieService,
    private val adminService: AdminService,
    props: PortholeAuthProperties,
) {
    private val rpId = props.webauthn.rpId
    private val rpName = props.webauthn.rpName
    private val origin = props.webauthn.origin
    private val webAuthnEnabled: Boolean get() = rpId.isNotBlank()
    private val log = LoggerFactory.getLogger(WebAuthnController::class.java)
    private val credentialRepository = YubicoCredentialRepository(userRepository)

    private val relyingParty: RelyingParty by lazy {
        RelyingParty.builder()
            .identity(RelyingPartyIdentity.builder().id(rpId).name(rpName).build())
            .credentialRepository(credentialRepository)
            .origins(setOf(origin))
            .build()
    }

    private val pendingRegistrations = ConcurrentHashMap<String, PendingRegistration>()
    private val pendingAssertions = ConcurrentHashMap<String, PendingAssertion>()

    // ── Register ──────────────────────────────────────────────────────────────

    @Post("/register/start")
    fun registerStart(@Body req: RegisterStartRequest): HttpResponse<*> {
        val username = req.username.trim().lowercase()
        if (username.isBlank()) return HttpResponse.badRequest<Any>()
        if (!USERNAME_PATTERN.matches(username)) return HttpResponse.badRequest<Any>()
        if (userRepository.findByUsername(username) != null) return HttpResponse.badRequest<Any>()

        evictExpired()

        val userId = UUID.randomUUID()
        val userIdentity = UserIdentity.builder()
            .name(username)
            .displayName(username)
            .id(ByteArray(userId.toString().toByteArray(Charsets.UTF_8)))
            .build()

        val options = relyingParty.startRegistration(
            StartRegistrationOptions.builder()
                .user(userIdentity)
                .authenticatorSelection(
                    AuthenticatorSelectionCriteria.builder()
                        .residentKey(ResidentKeyRequirement.REQUIRED)
                        .userVerification(UserVerificationRequirement.PREFERRED)
                        .build()
                )
                .timeout(60_000L)
                .build()
        )

        val sessionId = UUID.randomUUID().toString()
        pendingRegistrations[sessionId] = PendingRegistration(
            options = options,
            pendingUserId = userId,
            pendingUsername = username,
        )

        return HttpResponse.ok(
            RegisterStartResponse(
                sessionId = sessionId,
                challenge = options.challenge.base64Url,
                rp = RpInfo(id = options.rp.id, name = options.rp.name),
                user = UserInfo(id = userId.toString(), name = username, displayName = username),
                pubKeyCredParams = options.pubKeyCredParams.map { p ->
                    PubKeyCredParam(type = "public-key", alg = p.alg.id.toInt())
                },
                authenticatorSelection = AuthenticatorSelection(
                    userVerification = "preferred",
                    residentKey = "required",
                ),
                timeout = 60_000L,
            )
        )
    }

    @Post("/register/finish")
    fun registerFinish(@Body req: RegisterFinishRequest): HttpResponse<*> {
        evictExpired()
        val pending = pendingRegistrations.remove(req.sessionId) ?: run {
            log.warn("WebAuthn register/finish: unknown sessionId={}", req.sessionId)
            return HttpResponse.unauthorized<Any>()
        }
        if (isExpired(pending.createdAt)) {
            log.warn("WebAuthn register/finish: expired session")
            return HttpResponse.unauthorized<Any>()
        }

        val pkc: PublicKeyCredential<AuthenticatorAttestationResponse, ClientRegistrationExtensionOutputs> =
            runCatching {
                PublicKeyCredential.parseRegistrationResponseJson(buildRegistrationJson(req))
            }.getOrElse { e ->
                log.warn("WebAuthn register/finish: failed to parse registration JSON: {}", e.message)
                return HttpResponse.unauthorized<Any>()
            }

        val result = runCatching {
            relyingParty.finishRegistration(
                FinishRegistrationOptions.builder()
                    .request(pending.options)
                    .response(pkc)
                    .build()
            )
        }.getOrElse { e ->
            log.warn("WebAuthn register/finish: finishRegistration failed: {}", e.message, e)
            return HttpResponse.unauthorized<Any>()
        }

        val credential = PasskeyCredential(
            credentialId = result.keyId.id.base64Url,
            publicKeyCose = result.publicKeyCose.base64Url,
            signCount = result.signatureCount,
            createdAt = Instant.now().toString(),
        )

        // Re-check that the username is still available (guards against race between start/finish)
        val existing = userRepository.findByUsername(pending.pendingUsername)
        if (existing != null) return HttpResponse.status<Any>(HttpStatus.CONFLICT)

        val userRecord = UserRecord(
            id = pending.pendingUserId,
            username = pending.pendingUsername,
            passkeyCredential = credential,
        )
        userRepository.save(userRecord)

        val token = jwtTokenProvider.generateToken(userRecord.id, userRecord.username)
        return HttpResponse.ok(AuthResponse(userRecord.id, userRecord.username, userRecord.avatarUrl, isAdmin = adminService.isAdmin(userRecord.id)))
            .cookie(authCookieService.createAuthCookie(token))
    }

    // ── Authenticate ──────────────────────────────────────────────────────────

    @Post("/authenticate/start")
    fun authStart(@Body req: AuthStartRequest): HttpResponse<*> {
        evictExpired()

        val normalizedUsername = req.username?.trim()?.lowercase()?.takeIf { it.isNotBlank() }
        if (normalizedUsername != null && !USERNAME_PATTERN.matches(normalizedUsername)) {
            return HttpResponse.badRequest<Any>()
        }

        val startOptions = StartAssertionOptions.builder()
            .userVerification(UserVerificationRequirement.PREFERRED)
            .timeout(60_000L)
            .build()

        val assertionRequest = relyingParty.startAssertion(startOptions)
        val sessionId = UUID.randomUUID().toString()
        pendingAssertions[sessionId] = PendingAssertion(assertionRequest, expectedUsername = normalizedUsername)

        val allowCredentials: List<AllowCredential> = assertionRequest.publicKeyCredentialRequestOptions
            .allowCredentials
            .map { creds -> creds.map { AllowCredential(type = "public-key", id = it.id.base64Url) } }
            .orElseGet { emptyList() }

        return HttpResponse.ok(
            AuthStartResponse(
                sessionId = sessionId,
                challenge = assertionRequest.publicKeyCredentialRequestOptions.challenge.base64Url,
                allowCredentials = allowCredentials,
                userVerification = "preferred",
                timeout = 60_000L,
            )
        )
    }

    @Post("/authenticate/finish")
    fun authFinish(@Body req: AuthFinishRequest): HttpResponse<*> {
        if (!webAuthnEnabled) return HttpResponse.notFound<Any>()
        evictExpired()
        val pending = pendingAssertions.remove(req.sessionId) ?: run {
            log.warn("WebAuthn auth/finish: unknown sessionId={}", req.sessionId)
            return HttpResponse.unauthorized<Any>()
        }
        if (isExpired(pending.createdAt)) {
            log.warn("WebAuthn auth/finish: expired session")
            return HttpResponse.unauthorized<Any>()
        }

        val assertionJson = buildAssertionJson(req)
        val pkc: PublicKeyCredential<AuthenticatorAssertionResponse, ClientAssertionExtensionOutputs> =
            runCatching {
                PublicKeyCredential.parseAssertionResponseJson(assertionJson)
            }.getOrElse { e ->
                log.warn("WebAuthn auth/finish: failed to parse assertion JSON: {}", e.message)
                return HttpResponse.unauthorized<Any>()
            }

        val result = runCatching {
            relyingParty.finishAssertion(
                FinishAssertionOptions.builder()
                    .request(pending.request)
                    .response(pkc)
                    .build()
            )
        }.getOrElse { e ->
            log.warn("WebAuthn auth/finish: finishAssertion failed: {}", e.message, e)
            return HttpResponse.unauthorized<Any>()
        }

        if (!result.isSuccess) {
            log.warn("WebAuthn auth/finish: assertion result not successful")
            return HttpResponse.unauthorized<Any>()
        }

        if (pending.expectedUsername != null && result.username != pending.expectedUsername) {
            log.warn("WebAuthn auth/finish: assertion username mismatch")
            return HttpResponse.unauthorized<Any>()
        }

        val user = userRepository.findByUsername(result.username) ?: run {
            log.warn("WebAuthn auth/finish: user not found for username={}", result.username)
            return HttpResponse.unauthorized<Any>()
        }
        val updatedCred = user.passkeyCredential?.copy(signCount = result.signatureCount)
        if (updatedCred != null) {
            userRepository.save(user.copy(passkeyCredential = updatedCred))
        }

        val token = jwtTokenProvider.generateToken(user.id, user.username)
        return HttpResponse.ok(AuthResponse(user.id, user.username, user.avatarUrl, isAdmin = adminService.isAdmin(user.id)))
            .cookie(authCookieService.createAuthCookie(token))
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun evictExpired() {
        val now = System.currentTimeMillis()
        pendingRegistrations.entries.removeIf { (_, v) -> now - v.createdAt > SESSION_TTL_MS }
        pendingAssertions.entries.removeIf { (_, v) -> now - v.createdAt > SESSION_TTL_MS }
    }

    private fun isExpired(createdAt: Long) = System.currentTimeMillis() - createdAt > SESSION_TTL_MS

    private val objectMapper = ObjectMapper()

    /**
     * Serialise the finish-registration request into the JSON format expected by
     * [PublicKeyCredential.parseRegistrationResponseJson].
     * Uses Jackson to safely escape all user-supplied strings.
     */
    private fun buildRegistrationJson(req: RegisterFinishRequest): String {
        val map = mapOf(
            "type" to req.type,
            "id" to req.id,
            "rawId" to req.rawId,
            "response" to mapOf(
                "clientDataJSON" to req.attestationResponse.clientDataJSON,
                "attestationObject" to req.attestationResponse.attestationObject,
            ),
            "clientExtensionResults" to emptyMap<String, Any>(),
        )
        return objectMapper.writeValueAsString(map)
    }

    /**
     * Serialise the finish-authentication request into the JSON format expected by
     * [PublicKeyCredential.parseAssertionResponseJson].
     * Uses Jackson to safely escape all user-supplied strings.
     */
    private fun buildAssertionJson(req: AuthFinishRequest): String {
        val responseMap = mutableMapOf(
            "clientDataJSON" to req.assertionResponse.clientDataJSON,
            "authenticatorData" to req.assertionResponse.authenticatorData,
            "signature" to req.assertionResponse.signature,
        )
        req.assertionResponse.userHandle?.let { responseMap["userHandle"] = it }
        val map = mapOf(
            "type" to req.type,
            "id" to req.id,
            "rawId" to req.rawId,
            "response" to responseMap,
            "clientExtensionResults" to emptyMap<String, Any>(),
        )
        return objectMapper.writeValueAsString(map)
    }

    companion object {
        /** Only allow alphanumeric, hyphens, underscores, dots; 1-39 chars (matches GitHub login rules). */
        val USERNAME_PATTERN = Regex("^[a-z0-9](?:[a-z0-9._-]{0,37}[a-z0-9])?\$")
    }
}

