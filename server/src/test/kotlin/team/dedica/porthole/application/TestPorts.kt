package team.dedica.porthole.application

import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.MapState
import team.dedica.porthole.domain.QualityMetric
import java.util.UUID

class InMemoryMapStatePort : MapStatePort {
    private val store = mutableMapOf<UUID, MapState>()
    override fun findById(id: UUID): MapState? = store[id]
    override fun save(state: MapState) { store[state.id] = state }
    override fun findAll(): List<MapState> = store.values.toList()
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
    override fun send(mapId: UUID, state: MapState) {}
    override fun sendMatrix(mapId: UUID, matrix: CollaboratorMatrix) {}
    override fun sendMetrics(mapId: UUID, metrics: Map<UUID, QualityMetric>) {}
    override fun sendChoreLists(mapId: UUID, choreLists: Map<UUID, ChoreList>) {}
}
