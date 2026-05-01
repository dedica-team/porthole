package team.dedica.porthole.adapter.out.repository

import com.fasterxml.jackson.databind.annotation.JsonSerialize
import com.fasterxml.jackson.databind.ser.std.UUIDSerializer
import java.util.UUID

data class PasskeyCredential(
    val credentialId: String,   // Base64url-encoded
    val publicKeyCose: String,  // Base64url-encoded COSE public key
    val signCount: Long,
    val createdAt: String,      // ISO-8601
)

data class UserRecord(
    @get:JsonSerialize(using = UUIDSerializer::class)
    val id: UUID,
    val username: String,
    val githubId: String? = null,
    val keycloakId: String? = null,
    val email: String? = null,
    val avatarUrl: String? = null,
    val passkeyCredential: PasskeyCredential? = null,
)
