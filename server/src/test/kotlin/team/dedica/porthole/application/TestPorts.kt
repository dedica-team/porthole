package team.dedica.porthole.application

import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.MapState
import team.dedica.porthole.domain.QualityMetric

class InMemoryMapStatePort : MapStatePort {
    private val store = mutableMapOf<String, MapState>()
    override fun findById(id: String): MapState? = store[id]
    override fun save(state: MapState) { store[state.id] = state }
    override fun findAll(): List<MapState> = store.values.toList()
    override fun delete(id: String) { store.remove(id) }
}

class InMemoryTestUserRepository : UserWritePort {
    private val store = mutableMapOf<String, UserRecord>()
    override fun findByUsername(username: String): UserRecord? = store.values.find { it.username == username }
    override fun findByGithubId(githubId: String): UserRecord? = store.values.find { it.githubId == githubId }
    override fun findByKeycloakId(keycloakId: String): UserRecord? = store.values.find { it.keycloakId == keycloakId }
    override fun findById(id: String): UserRecord? = store[id]
    override fun findByCredentialId(credentialId: String): UserRecord? =
        store.values.find { it.passkeyCredential?.credentialId == credentialId }
    override fun save(user: UserRecord) { store[user.id] = user }
}

class NoOpBroadcastPort : BroadcastPort {
    override fun send(mapId: String, state: MapState) {}
    override fun sendMatrix(mapId: String, matrix: CollaboratorMatrix) {}
    override fun sendMetrics(mapId: String, metrics: Map<String, QualityMetric>) {}
    override fun sendChoreLists(mapId: String, choreLists: Map<String, ChoreList>) {}
}
