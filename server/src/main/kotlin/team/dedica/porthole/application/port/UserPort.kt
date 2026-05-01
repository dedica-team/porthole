package team.dedica.porthole.application.port

import team.dedica.porthole.adapter.out.repository.UserRecord
import java.util.UUID

interface UserPort {
    fun findByGithubId(githubId: String): UserRecord?
    fun findByKeycloakId(keycloakId: String): UserRecord?
    fun findByUsername(username: String): UserRecord?
    fun findById(id: UUID): UserRecord?
    fun findByCredentialId(credentialId: String): UserRecord?
    fun save(user: UserRecord)
}
