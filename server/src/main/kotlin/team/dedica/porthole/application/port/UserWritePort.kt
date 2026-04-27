package team.dedica.porthole.application.port

import team.dedica.porthole.adapter.out.repository.UserRecord

interface UserWritePort {
    fun findByGithubId(githubId: String): UserRecord?
    fun findByUsername(username: String): UserRecord?
    fun findById(id: String): UserRecord?
    fun findByCredentialId(credentialId: String): UserRecord?
    fun save(user: UserRecord)
}
