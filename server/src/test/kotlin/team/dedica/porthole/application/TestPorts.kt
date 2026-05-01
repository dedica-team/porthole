package team.dedica.porthole.application

import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.QualityMetric
import java.util.UUID

class InMemorySessionStatePort : SessionStatePort {
    private val store = mutableMapOf<UUID, SessionState>()
    override fun findById(id: UUID): SessionState? = store[id]
    override fun save(state: SessionState) { store[state.id] = state }
    override fun findAll(): List<SessionState> = store.values.toList()
    override fun delete(id: UUID) { store.remove(id) }
}

class InMemoryTestUserRepository : UserPort {
    private val store = mutableMapOf<String, UserRecord>()
    override fun findByUsername(username: String): UserRecord? = store.values.find { it.username == username }
    override fun findByGithubId(githubId: String): UserRecord? = store.values.find { it.githubId == githubId }
    override fun findByKeycloakId(keycloakId: String): UserRecord? = store.values.find { it.keycloakId == keycloakId }
    override fun findById(id: UUID): UserRecord? = store[id.toString()]
    override fun findByCredentialId(credentialId: String): UserRecord? =
        store.values.find { it.passkeyCredential?.credentialId == credentialId }
    override fun save(user: UserRecord) { store[user.id.toString()] = user }
}

class NoOpBroadcastPort : BroadcastPort {
    override fun send(mapId: UUID, state: SessionState) {}
    override fun sendMatrix(mapId: UUID, matrix: CollaboratorMatrix) {}
    override fun sendMetrics(mapId: UUID, metrics: Map<UUID, QualityMetric>) {}
    override fun sendChoreLists(mapId: UUID, choreLists: Map<UUID, ChoreList>) {}
}

class InMemoryAuthorizationPort(
    private val sessionStatePort: SessionStatePort,
) : AuthorizationPort {
    private val adminIds = mutableSetOf<UUID>()

    fun makeAdmin(userId: UUID) { adminIds += userId }

    override fun accessSession(userId: UUID, sessionId: UUID, requiredRole: SessionRole): SessionState {
        val state = sessionStatePort.findById(sessionId)
            ?: throw NoSuchElementException("Session $sessionId not found")
        val role = when {
            userId in adminIds -> SessionRole.ADMIN
            state.isCollaborator(userId) -> SessionRole.COLLABORATOR
            state.hasPendingRequest(userId) -> SessionRole.REQUEST_PENDING
            else -> SessionRole.VIEWER
        }
        role.mustHaveRole(requiredRole)
        return state
    }
}

