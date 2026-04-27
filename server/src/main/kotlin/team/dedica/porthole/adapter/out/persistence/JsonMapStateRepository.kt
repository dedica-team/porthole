package team.dedica.porthole.adapter.out.persistence

import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Repository
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.domain.MapState
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * [MapStatePort] implementation backed by [JsonStore].
 *
 * All mutations are applied to the in-memory map immediately and then mark
 * the map dirty so it is persisted after the debounce window.
 * Per-map locks prevent lost-update race conditions when multiple collaborators
 * edit the same map concurrently.
 */
@Primary
@Repository
class JsonMapStateRepository(private val store: JsonStore) : MapStatePort {

    private val mapLocks = ConcurrentHashMap<String, ReentrantLock>()
    private fun lockFor(mapId: String) = mapLocks.computeIfAbsent(mapId) { ReentrantLock() }

    override fun findById(id: String): MapState? = store.mapStates[id]

    override fun save(state: MapState): Unit = lockFor(state.id).withLock {
        store.mapStates[state.id] = state
        store.markMapDirty(state.id)
    }

    override fun findAll(): List<MapState> = store.mapStates.values.toList()

    override fun delete(id: String): Unit = lockFor(id).withLock {
        store.mapStates.remove(id)
        store.deleteMapFile(id)
    }
}
