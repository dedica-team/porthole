package team.dedica.porthole.adapter.out.persistence

import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Repository
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionState
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * [SessionStatePort] implementation backed by [JsonStore].
 *
 * All mutations are applied to the in-memory map immediately and then mark
 * the map dirty so it is persisted after the debounce window.
 * Per-map locks prevent lost-update race conditions when multiple collaborators
 * edit the same map concurrently.
 */
@Primary
@Repository
class JsonSessionStateRepository(private val store: JsonStore) : SessionStatePort {

    private val mapLocks = ConcurrentHashMap<UUID, ReentrantLock>()
    private fun lockFor(mapId: UUID) = mapLocks.computeIfAbsent(mapId) { ReentrantLock() }

    override fun findById(id: UUID): SessionState? = store.sessionStates[id]

    override fun save(state: SessionState): Unit = lockFor(state.id).withLock {
        store.sessionStates[state.id] = state
        store.markMapDirty(state.id)
    }

    override fun findAll(): List<SessionState> = store.sessionStates.values.toList()

    override fun delete(id: UUID): Unit = lockFor(id).withLock {
        store.sessionStates.remove(id)
        store.deleteMapFile(id)
    }
}
