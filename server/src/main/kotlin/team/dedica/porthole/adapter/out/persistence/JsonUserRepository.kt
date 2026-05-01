package team.dedica.porthole.adapter.out.persistence

import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Repository
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.UserPort
import java.util.UUID

/**
 * [UserPort] implementation backed by [JsonStore].
 */
@Primary
@Repository
class JsonUserRepository(private val store: JsonStore) : UserPort {

    override fun findByUsername(username: String): UserRecord? =
        store.users.values.find { it.username.equals(username, ignoreCase = true) }

    override fun findByGithubId(githubId: String): UserRecord? =
        store.users.values.find { it.githubId == githubId }

    override fun findByKeycloakId(keycloakId: String): UserRecord? =
        store.users.values.find { it.keycloakId == keycloakId }

    override fun findById(id: UUID): UserRecord? = store.users[id]

    override fun findByCredentialId(credentialId: String): UserRecord? =
        store.users.values.find { it.passkeyCredential?.credentialId == credentialId }

    override fun save(user: UserRecord) {
        store.users[user.id] = user
        store.markUsersDirty()
    }
}
