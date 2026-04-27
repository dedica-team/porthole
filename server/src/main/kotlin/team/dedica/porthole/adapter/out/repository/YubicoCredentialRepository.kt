package team.dedica.porthole.adapter.out.repository

import com.yubico.webauthn.CredentialRepository
import com.yubico.webauthn.RegisteredCredential
import com.yubico.webauthn.data.ByteArray
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor
import team.dedica.porthole.application.port.UserWritePort
import java.util.Optional

/**
 * Bridges Yubico's [CredentialRepository] interface to our [UserWritePort].
 * Each user holds at most one passkey credential.
 */
@Suppress("unused") // instantiated at runtime in WebAuthnController
class YubicoCredentialRepository(
    private val userPort: UserWritePort,
) : CredentialRepository {

    override fun getCredentialIdsForUsername(username: String): Set<PublicKeyCredentialDescriptor> {
        val cred = userPort.findByUsername(username)?.passkeyCredential ?: return emptySet()
        return setOf(
            PublicKeyCredentialDescriptor.builder()
                .id(ByteArray.fromBase64Url(cred.credentialId))
                .build()
        )
    }

    override fun getUserHandleForUsername(username: String): Optional<ByteArray> {
        val user = userPort.findByUsername(username) ?: return Optional.empty()
        return Optional.of(ByteArray(user.id.toByteArray(Charsets.UTF_8)))
    }

    override fun getUsernameForUserHandle(userHandle: ByteArray): Optional<String> {
        val id = String(userHandle.bytes, Charsets.UTF_8)
        val user = userPort.findById(id) ?: return Optional.empty()
        return Optional.of(user.username)
    }

    /**
     * Look up a specific credential by credentialId + userHandle.
     */
    override fun lookup(credentialId: ByteArray, userHandle: ByteArray): Optional<RegisteredCredential> {
        val credIdB64 = credentialId.base64Url
        val user = userPort.findByCredentialId(credIdB64) ?: return Optional.empty()
        val cred = user.passkeyCredential ?: return Optional.empty()
        return Optional.of(buildRegisteredCredential(user, cred))
    }

    /**
     * Look up all credentials for a given credentialId (we store one per user).
     */
    override fun lookupAll(credentialId: ByteArray): Set<RegisteredCredential> {
        val credIdB64 = credentialId.base64Url
        val user = userPort.findByCredentialId(credIdB64) ?: return emptySet()
        val cred = user.passkeyCredential ?: return emptySet()
        return setOf(buildRegisteredCredential(user, cred))
    }

    private fun buildRegisteredCredential(user: UserRecord, cred: PasskeyCredential) =
        RegisteredCredential.builder()
            .credentialId(ByteArray.fromBase64Url(cred.credentialId))
            .userHandle(ByteArray(user.id.toByteArray(Charsets.UTF_8)))
            .publicKeyCose(ByteArray.fromBase64Url(cred.publicKeyCose))
            .signatureCount(cred.signCount)
            .build()
}
