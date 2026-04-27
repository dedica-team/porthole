package team.dedica.porthole.adapter.out.persistence

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.annotation.PreDestroy
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.domain.MapState
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.StandardCopyOption
import java.util.concurrent.ConcurrentHashMap

/**
 * Holds the in-memory object graph and persists it to JSON files on disk.
 *
 * Persistence strategy: **One file per map + Debounced Flush**
 * - Each MapState lives in its own `maps/<id>.json` file so sessions are
 *   fully decoupled on disk.
 * - Every mutation records the dirty-timestamp for that map ID only.
 * - A `@Scheduled` job (fires every second) flushes maps that have been
 *   quiet for at least `debounce-ms` milliseconds (default 5 000 ms).
 *   A new mutation resets the timer, delaying the write by another debounce
 *   window.
 * - `@PreDestroy` flushes all remaining dirty maps immediately on shutdown.
 * - Writes are atomic (write to `.tmp` file, then rename).
 */
@Component
class JsonStore(
    @Qualifier("persistenceObjectMapper") private val mapper: ObjectMapper,
    @Value("\${porthole.storage.path:data/json}") storagePath: String,
    @Value("\${porthole.storage.debounce-ms:5000}") private val debounceMs: Long,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private val storageDir: Path = Paths.get(storagePath).toAbsolutePath().normalize()
    private val mapsDir:    Path = storageDir.resolve("maps")
    private val usersFile:  Path = storageDir.resolve("users.json")

    /** Last-mutation timestamp (ms) per map ID. Presence means the map is dirty. */
    private val dirtyAt = ConcurrentHashMap<String, Long>()

    @Volatile private var usersDirty = false

    lateinit var mapStates: ConcurrentHashMap<String, MapState>
    lateinit var users:     ConcurrentHashMap<String, UserRecord>

    init {
        Files.createDirectories(storageDir)
        Files.createDirectories(mapsDir)
        mapStates = loadAllMaps()
        users     = loadOrEmpty(usersFile, object : com.fasterxml.jackson.core.type.TypeReference<Map<String, UserRecord>>() {})
        log.info(
            "JsonStore initialised – {} map(s), {} user(s) loaded from {}",
            mapStates.size, users.size, storageDir,
        )
    }

    // ── Dirty-flag setters ────────────────────────────────────────────────────

    fun markMapDirty(id: String) {
        dirtyAt[id] = System.currentTimeMillis()
    }

    fun markUsersDirty() {
        usersDirty = true
    }

    // ── Delete map file immediately ───────────────────────────────────────────

    fun deleteMapFile(id: String) {
        dirtyAt.remove(id)
        val file = mapsDir.resolve("$id.json")
        Files.deleteIfExists(file)
        log.debug("Deleted map file {}", file.fileName)
    }

    // ── Debounced per-map flush ───────────────────────────────────────────────

    /** Flush all maps whose quiet window has elapsed. Called by the scheduler. */
    fun flushDueMaps() {
        val now = System.currentTimeMillis()
        dirtyAt.forEach { (id, ts) ->
            if (now - ts >= debounceMs) saveMap(id)
        }
        saveUsersIfDirty()
    }

    /** Flush every dirty map immediately regardless of debounce window. */
    fun flushAllDirtyMaps() {
        dirtyAt.keys.toList().forEach { saveMap(it) }
        saveUsersIfDirty()
    }

    @Synchronized
    private fun saveMap(id: String) {
        // Re-check under lock: another thread may have already flushed
        if (!dirtyAt.containsKey(id)) return
        val state = mapStates[id] ?: run {
            dirtyAt.remove(id)
            return
        }
        writeAtomic(mapsDir.resolve("$id.json"), state)
        dirtyAt.remove(id)
        log.debug("Flushed map {}", id)
    }

    @Synchronized
    fun saveUsersIfDirty() {
        if (!usersDirty) return
        writeAtomic(usersFile, users)
        usersDirty = false
        log.debug("users.json flushed ({} entries)", users.size)
    }

    // ── Scheduled flush (every 1 s, checks debounce window) ──────────────────

    @Scheduled(fixedDelayString = "\${porthole.storage.flush-interval-ms:1000}")
    fun scheduledFlush() = flushDueMaps()

    // ── Shutdown hook ─────────────────────────────────────────────────────────

    @PreDestroy
    fun flushOnShutdown() {
        log.info("JsonStore shutdown – flushing pending changes")
        flushAllDirtyMaps()
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private fun loadAllMaps(): ConcurrentHashMap<String, MapState> {
        val result = ConcurrentHashMap<String, MapState>()
        Files.list(mapsDir)
            .filter { it.toString().endsWith(".json") }
            .forEach { file ->
                try {
                    val state = mapper.readValue(file.toFile(), MapState::class.java)
                    requireNotNull(state.id) { "MapState.id is null in '${file.fileName}'" }
                    requireNotNull(state.map) { "MapState.map is null in '${file.fileName}'" }
                    result[state.id] = state
                } catch (e: Exception) {
                    log.error("═══════════════════════════════════════════════════════")
                    log.error("DATA CORRUPTION: Failed to load '{}'", file.toAbsolutePath())
                    log.error("Cause: {}", e.message)
                    log.error("Fix or restore '{}' and restart.", file.fileName)
                    log.error("═══════════════════════════════════════════════════════")
                    throw IllegalStateException(
                        "Data corruption: cannot load '${file.toAbsolutePath()}' – ${e.message}", e,
                    )
                }
            }
        return result
    }

    private fun <V> loadOrEmpty(
        file: Path,
        typeRef: com.fasterxml.jackson.core.type.TypeReference<Map<String, V>>,
    ): ConcurrentHashMap<String, V> {
        if (!Files.exists(file)) return ConcurrentHashMap()
        return try {
            val loaded: Map<String, V> = mapper.readValue(file.toFile(), typeRef)
            ConcurrentHashMap(loaded)
        } catch (e: Exception) {
            log.error("DATA CORRUPTION: Failed to load '{}'", file.toAbsolutePath())
            log.error("Cause: {}", e.message)
            throw IllegalStateException(
                "Data corruption: cannot load '${file.toAbsolutePath()}' – ${e.message}", e,
            )
        }
    }

    private fun writeAtomic(target: Path, data: Any) {
        val tmp = target.resolveSibling(target.fileName.toString() + ".tmp")
        mapper.writerWithDefaultPrettyPrinter().writeValue(tmp.toFile(), data)
        Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
    }
}
