package team.dedica.porthole.adapter.out.persistence

import com.fasterxml.jackson.module.kotlin.readValue
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.io.TempDir
import team.dedica.porthole.domain.*
import java.nio.file.Files
import java.nio.file.Path
import java.util.*

/**
 * Unit / integration tests for [JsonMapStateRepository] and [JsonStore].
 *
 * Each test class uses its own [TempDir] so tests are fully isolated.
 * "Restart" is simulated by creating a new [JsonStore] on the same directory.
 */
class JsonMapStateRepositoryTest {

    private val config = JsonPersistenceConfig()
    private val mapper = config.persistenceObjectMapper()

    // ── helpers ───────────────────────────────────────────────────────────────

    private fun storeAt(dir: Path, debounceMs: Long = 0L) =
        JsonStore(mapper, dir.toAbsolutePath().toString(), debounceMs)

    private fun repoAt(dir: Path) =
        JsonMapStateRepository(storeAt(dir))

    private fun createStateWithLandmark(): MapState {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        val state = MapState(map = map)
        val coord = HexCoordinate(0, 0)
        val landmark = Landmark(
            id = UUID.randomUUID().toString(),
            name = "Test Landmark",
            ownerId = "p1",
            coordinate = coord,
            type = LandmarkType.KEEP,
        )
        state.landmarks[landmark.id] = landmark
        state.map.setOwner(coord, "p1")
        return state
    }

    // ── Basic CRUD ─────────────────────────────────────────────────────────────

    @Nested
    inner class Crud {

        @TempDir lateinit var dir: Path

        @Test
        fun `save and findById returns the same state`() {
            val repo = repoAt(dir)
            val state = createStateWithLandmark()
            repo.save(state)
            val found = repo.findById(state.id)
            assertNotNull(found)
            assertEquals(state.id, found!!.id)
        }

        @Test
        fun `findAll returns all saved states`() {
            val repo = repoAt(dir)
            val s1 = createStateWithLandmark()
            val s2 = createStateWithLandmark()
            repo.save(s1)
            repo.save(s2)
            val all = repo.findAll()
            assertEquals(2, all.size)
            assertTrue(all.any { it.id == s1.id })
            assertTrue(all.any { it.id == s2.id })
        }

        @Test
        fun `delete removes the state`() {
            val repo = repoAt(dir)
            val state = createStateWithLandmark()
            repo.save(state)
            repo.delete(state.id)
            assertNull(repo.findById(state.id))
            assertEquals(0, repo.findAll().size)
        }

        @Test
        fun `findById returns null for unknown id`() {
            val repo = repoAt(dir)
            assertNull(repo.findById("does-not-exist"))
        }
    }

    // ── Restart / persistence ──────────────────────────────────────────────────

    @Nested
    inner class Persistence {

        @TempDir lateinit var dir: Path

        private fun flush(repo: JsonMapStateRepository) {
            repo.javaClass.getDeclaredField("store")
                .also { it.isAccessible = true }
                .let { (it.get(repo) as JsonStore).flushAllDirtyMaps() }
        }

        @Test
        fun `saved state survives a restart`() {
            val repo = repoAt(dir)
            val state = createStateWithLandmark()
            repo.save(state)
            flush(repo)

            val loaded = repoAt(dir).findById(state.id)
            assertNotNull(loaded)
            assertEquals(state.id, loaded!!.id)
        }

        @Test
        fun `landmark survives a restart`() {
            val repo = repoAt(dir)
            val state = createStateWithLandmark()
            val landmark = state.landmarks.values.first()
            repo.save(state)
            flush(repo)

            val loaded = repoAt(dir).findById(state.id)!!
            val restored = loaded.getLandmarkAt(landmark.coordinate!!)
            assertNotNull(restored)
            assertEquals(landmark.id, restored!!.id)
            assertEquals(landmark.ownerId, restored.ownerId)
            assertEquals(landmark.type, restored.type)
            assertEquals(landmark.coordinate, restored.coordinate)
        }

        @Test
        fun `tile ownership survives a restart`() {
            val repo = repoAt(dir)
            val state = createStateWithLandmark()
            val coord = state.landmarks.values.first().coordinate!!
            repo.save(state)
            flush(repo)

            val loaded = repoAt(dir).findById(state.id)!!
            val tile = loaded.map.getTile(coord)
            assertNotNull(tile)
            assertEquals("p1", tile!!.ownerId)
        }

        @Test
        fun `landmark type change survives a restart`() {
            val repo = repoAt(dir)
            val state = createStateWithLandmark()
            val landmark = state.landmarks.values.first()
            state.landmarks[landmark.id] = landmark.copy(type = LandmarkType.RUINS)
            repo.save(state)
            flush(repo)

            val loaded = repoAt(dir).findById(state.id)!!
            assertEquals(LandmarkType.RUINS, loaded.getLandmarkAt(landmark.coordinate!!)!!.type)
        }

        @Test
        fun `multiple landmarks all survive a restart`() {
            val repo = repoAt(dir)
            val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
            val state = MapState(map = map)
            val coords = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0), HexCoordinate(-1, 1))
            coords.forEach { coord ->
                val lm = Landmark(
                    id = UUID.randomUUID().toString(),
                    name = "Landmark $coord",
                    ownerId = "p1",
                    coordinate = coord,
                )
                state.landmarks[lm.id] = lm
                state.map.setOwner(coord, "p1")
            }
            repo.save(state)
            flush(repo)

            val loaded = repoAt(dir).findById(state.id)!!
            assertEquals(3, loaded.landmarks.size)
            coords.forEach { coord ->
                assertNotNull(loaded.getLandmarkAt(coord), "Landmark at $coord should be present")
            }
        }

        @Test
        fun `two maps both survive a restart`() {
            val repo = repoAt(dir)
            val s1 = createStateWithLandmark()
            val s2 = createStateWithLandmark()
            repo.save(s1)
            repo.save(s2)
            flush(repo)

            val all = repoAt(dir).findAll()
            assertEquals(2, all.size)
            assertTrue(all.any { it.id == s1.id })
            assertTrue(all.any { it.id == s2.id })
        }

        @Test
        fun `delete is reflected after restart`() {
            val repo = repoAt(dir)
            val s1 = createStateWithLandmark()
            val s2 = createStateWithLandmark()
            repo.save(s1)
            repo.save(s2)
            repo.delete(s1.id)
            flush(repo)

            val all = repoAt(dir).findAll()
            assertEquals(1, all.size)
            assertEquals(s2.id, all.first().id)
        }

        @Test
        fun `activeCollaborators is not serialised and does not cause deserialization error`() {
            // Regression: activeCollaborators is a computed getter returning an unmodifiable
            // list; Jackson must not try to set it during deserialization.
            val repo = repoAt(dir)
            val state = MapState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
            state.collaborators.add(Collaborator(id = "u1", username = "alice"))
            repo.save(state)
            flush(repo)

            val loaded = repoAt(dir).findById(state.id)!!
            assertEquals(1, loaded.collaborators.size)
            assertEquals("alice", loaded.collaborators.first().username)
        }
    }

    // ── Corrupt / unreadable data ──────────────────────────────────────────────

    @Nested
    inner class CorruptData {

        @Test
        fun `corrupt map json in maps dir throws IllegalStateException with clear message`(@TempDir dir: Path) {
            val mapsDir = dir.resolve("maps").also { Files.createDirectories(it) }
            mapsDir.resolve("bad-id.json").toFile().writeText("{ this is not valid json }")
            val ex = assertThrows<IllegalStateException> { storeAt(dir) }
            assertTrue(ex.message!!.contains("Data corruption"),
                "Exception message should mention data corruption")
            assertTrue(ex.message!!.contains("bad-id.json"),
                "Exception message should name the corrupt file")
        }

        @Test
        fun `corrupt users json throws IllegalStateException with clear message`(@TempDir dir: Path) {
            dir.resolve("users.json").toFile().writeText("not json at all")
            val ex = assertThrows<IllegalStateException> { storeAt(dir) }
            assertTrue(ex.message!!.contains("Data corruption"))
            assertTrue(ex.message!!.contains("users.json"))
        }
    }

    // ── Enum serialisation ─────────────────────────────────────────────────────

    @Nested
    inner class EnumSerialization {

        @TempDir lateinit var dir: Path

        @Test
        fun `terrain enum is written as string name in JSON`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)
            store.flushAllDirtyMaps()

            val json = dir.resolve("maps/${state.id}.json").toFile().readText()
            assertTrue(json.contains("\"GRASS\"") || json.contains("\"WATER\"") ||
                       json.contains("\"FOREST\"") || json.contains("\"ROCKS\""),
                "Terrain enum should be serialised as a string name, not an ordinal")
            assertFalse(json.matches(Regex(".*\"terrain\"\\s*:\\s*\\d.*")),
                "Terrain must not be a number in JSON")
        }

        @Test
        fun `landmark type enum is written as string name in JSON`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)
            store.flushAllDirtyMaps()

            val json = dir.resolve("maps/${state.id}.json").toFile().readText()
            assertTrue(json.contains("\"KEEP\""), "LandmarkType should be serialised as 'KEEP'")
        }

        @Test
        fun `all enum values round-trip correctly for LandmarkType`() {
            LandmarkType.entries
                .filter { !it.name.startsWith("DEPRECATED_") }
                .forEach { type ->
                    val json = mapper.writeValueAsString(type)
                    val restored = mapper.readValue<LandmarkType>(json)
                    assertEquals(type, restored, "LandmarkType $type should round-trip")
                }
        }

        @Test
        fun `all enum values round-trip correctly for Terrain`() {
            Terrain.entries.forEach { terrain ->
                val json = mapper.writeValueAsString(terrain)
                val restored = mapper.readValue<Terrain>(json)
                assertEquals(terrain, restored, "Terrain $terrain should round-trip")
            }
        }

        @Test
        fun `all enum values round-trip correctly for ConnectionType`() {
            ConnectionType.entries.forEach { ct ->
                val json = mapper.writeValueAsString(ct)
                val restored = mapper.readValue<ConnectionType>(json)
                assertEquals(ct, restored, "ConnectionType $ct should round-trip")
            }
        }

        @Test
        fun `unknown LandmarkType in JSON is mapped to KEEP`() {
            // Simulate a JSON file written with a now-removed type (e.g. "WATERMILL")
            val json = "\"WATERMILL\""
            val result = mapper.readValue<LandmarkType>(json)
            assertEquals(LandmarkType.KEEP, result,
                "Unknown LandmarkType 'WATERMILL' should fall back to KEEP")
        }

        @Test
        fun `DEPRECATED_ prefixed LandmarkType in JSON is mapped to KEEP`() {
            val json = "\"DEPRECATED_WELL\""
            val result = mapper.readValue<LandmarkType>(json)
            assertEquals(LandmarkType.KEEP, result,
                "Deprecated LandmarkType 'DEPRECATED_WELL' should fall back to KEEP")
        }

        @Test
        fun `landmark with unknown type in full MapState JSON is loaded with KEEP`(@TempDir dir: Path) {
            val mapsDir = dir.resolve("maps").also { Files.createDirectories(it) }
            val rawJson = buildString {
                append("""{"id":"map-id-1","map":{"tiles":[""")
                append("""{"coordinate":{"q":0,"r":0},"elevation":2,"terrain":"GRASS","ownerId":"p1"}""")
                append("""]},"collaborators":[],"landmarks":{"lm1":{"id":"lm1","name":"lm1",""")
                append(""""ownerId":"p1","coordinate":{"q":0,"r":0},"type":"WATERMILL",""")
                append(""""metrics":{}}},"connections":{},"groups":{},"metrics":{},""")
                append(""""createdAt":"2024-01-01T00:00:00Z"}}""")
            }
            mapsDir.resolve("map-id-1.json").toFile().writeText(rawJson)

            val loaded = repoAt(dir).findById("map-id-1")!!
            assertEquals(LandmarkType.KEEP, loaded.landmarks["lm1"]!!.type,
                "Landmark with removed type 'WATERMILL' should be loaded as KEEP")
        }
    }

    // ── HexCoordinate key serialisation ────────────────────────────────────────

    @Nested
    inner class HexCoordinateKeys {

        @TempDir lateinit var dir: Path

        @Test
        fun `HexCoordinate map key is written as q colon r string`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)
            store.flushAllDirtyMaps()

            val json = dir.resolve("maps/${state.id}.json").toFile().readText()
            // tileMap keys should appear as "q:r"
            assertTrue(json.contains("\"0:0\""), "HexCoordinate (0,0) should be serialised as '0:0'")
        }

        @Test
        fun `negative coordinates are serialised and deserialised correctly`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val map = HexMap.createHexagonal(radius = 2, elevationFn = { 2 })
            val state = MapState(map = map)
            val negCoord = HexCoordinate(-2, 1)
            val lm = Landmark(id = "neg-lm", ownerId = "p1", coordinate = negCoord)
            state.landmarks[lm.id] = lm
            state.map.setOwner(negCoord, "p1")
            repo.save(state)
            store.flushAllDirtyMaps()

            val loaded = repoAt(dir).findById(state.id)!!
            assertNotNull(loaded.getLandmarkAt(negCoord))
            assertEquals("p1", loaded.map.getTile(negCoord)?.ownerId)
        }
    }

    // ── Dirty-flag / no unnecessary writes ─────────────────────────────────────

    @Nested
    inner class DirtyFlag {

        @TempDir lateinit var dir: Path

        @Test
        fun `no file is written when nothing changed`() {
            val store = storeAt(dir)
            store.flushAllDirtyMaps()  // nothing dirty yet
            assertFalse(dir.resolve("maps").toFile().listFiles()?.isNotEmpty() ?: false,
                "No map file must be written when nothing is dirty")
        }

        @Test
        fun `file is written after first save`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)
            store.flushAllDirtyMaps()
            assertTrue(dir.resolve("maps/${state.id}.json").toFile().exists())
        }

        @Test
        fun `second flush without change does not update last-modified time`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)
            store.flushAllDirtyMaps()

            val file = dir.resolve("maps/${state.id}.json").toFile()
            val lastMod = file.lastModified()
            Thread.sleep(50)
            store.flushAllDirtyMaps() // flag is false – must not write
            assertEquals(lastMod, file.lastModified(),
                "File must not be touched when dirty flag is false")
        }
    }

    // ── Connections and groups ─────────────────────────────────────────────────

    @Nested
    inner class FullGraph {

        @TempDir lateinit var dir: Path

        private fun flush(store: JsonStore) = store.flushAllDirtyMaps()

        @Test
        fun `connection survives restart`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
            val state = MapState(map = map)
            val lm1 = Landmark(id = "lm1", ownerId = "p1", coordinate = HexCoordinate(0, 0))
            val lm2 = Landmark(id = "lm2", ownerId = "p1", coordinate = HexCoordinate(1, 0))
            state.landmarks[lm1.id] = lm1
            state.landmarks[lm2.id] = lm2
            val conn = Connection(
                id = "conn1", originId = lm1.id, targetId = lm2.id,
                path = listOf(HexCoordinate(0, 0), HexCoordinate(1, 0)),
                type = ConnectionType.STREET,
            )
            state.connections[conn.id] = conn
            repo.save(state)
            flush(store)

            val loaded = repoAt(dir).findById(state.id)!!
            assertEquals(1, loaded.connections.size)
            val restoredConn = loaded.connections["conn1"]!!
            assertEquals(ConnectionType.STREET, restoredConn.type)
            assertEquals(lm1.id, restoredConn.originId)
        }

        @Test
        fun `group survives restart`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val state = MapState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))
            val group = LandmarkGroup(id = "g1", name = "Alpha Team", color = "#ff0000")
            state.groups[group.id] = group
            repo.save(state)
            flush(store)

            val loaded = repoAt(dir).findById(state.id)!!
            assertEquals(1, loaded.groups.size)
            assertEquals("Alpha Team", loaded.groups["g1"]!!.name)
        }

        @Test
        fun `quality metrics survive restart`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val state = MapState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))
            val metric = QualityMetric(id = "m1", name = "Availability", description = "Uptime %")
            state.metrics[metric.id] = metric
            repo.save(state)
            flush(store)

            val loaded = repoAt(dir).findById(state.id)!!
            assertEquals(1, loaded.metrics.size)
            assertEquals("Availability", loaded.metrics["m1"]!!.name)
        }

        @Test
        fun `landmark metric entries survive restart`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 })
            val state = MapState(map = map)
            val entry = LandmarkMetricEntry(metricId = "m1", value = "99.9%", level = QualityLevel.OK)
            val lm = Landmark(
                id = "lm1", ownerId = "p1",
                coordinate = HexCoordinate(0, 0),
                metrics = mapOf("m1" to entry),
            )
            state.landmarks[lm.id] = lm
            repo.save(state)
            flush(store)

            val loaded = repoAt(dir).findById(state.id)!!
            val restoredEntry = loaded.landmarks["lm1"]!!.metrics["m1"]!!
            assertEquals("99.9%", restoredEntry.value)
            assertEquals(QualityLevel.OK, restoredEntry.level)
        }
    }

    // ── One file per map ───────────────────────────────────────────────────────

    @Nested
    inner class FilePerMap {

        @TempDir lateinit var dir: Path

        @Test
        fun `each map is stored in its own file under maps dir`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val s1 = createStateWithLandmark()
            val s2 = createStateWithLandmark()
            repo.save(s1)
            repo.save(s2)
            store.flushAllDirtyMaps()

            assertTrue(dir.resolve("maps/${s1.id}.json").toFile().exists(), "File for s1 must exist")
            assertTrue(dir.resolve("maps/${s2.id}.json").toFile().exists(), "File for s2 must exist")
        }

        @Test
        fun `saving one map does not touch another map file`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val s1 = createStateWithLandmark()
            val s2 = createStateWithLandmark()
            repo.save(s1)
            repo.save(s2)
            store.flushAllDirtyMaps()

            val file2 = dir.resolve("maps/${s2.id}.json").toFile()
            val lastMod = file2.lastModified()
            Thread.sleep(50)

            // Mutate only s1
            repo.save(s1.copy())
            store.flushAllDirtyMaps()

            assertEquals(lastMod, file2.lastModified(), "s2 file must not be touched when only s1 changed")
        }

        @Test
        fun `delete removes the map file`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)
            store.flushAllDirtyMaps()
            assertTrue(dir.resolve("maps/${state.id}.json").toFile().exists())

            repo.delete(state.id)
            assertFalse(dir.resolve("maps/${state.id}.json").toFile().exists(), "File must be deleted")
        }

        @Test
        fun `delete does not leave map in dirtyAt`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)
            repo.delete(state.id)
            // Flushing must not recreate the file
            store.flushAllDirtyMaps()
            assertFalse(dir.resolve("maps/${state.id}.json").toFile().exists(),
                "Deleted map must not be recreated by flush")
        }

        @Test
        fun `each map file contains only that map`() {
            val store = storeAt(dir)
            val repo = JsonMapStateRepository(store)
            val s1 = createStateWithLandmark()
            val s2 = createStateWithLandmark()
            repo.save(s1)
            repo.save(s2)
            store.flushAllDirtyMaps()

            val json1 = dir.resolve("maps/${s1.id}.json").toFile().readText()
            assertFalse(json1.contains(s2.id), "s1 file must not contain s2 id")

            val json2 = dir.resolve("maps/${s2.id}.json").toFile().readText()
            assertFalse(json2.contains(s1.id), "s2 file must not contain s1 id")
        }
    }

    // ── Debounce behaviour ────────────────────────────────────────────────────

    @Nested
    inner class Debounce {

        @TempDir lateinit var dir: Path

        @Test
        fun `map is not flushed before debounce window elapses`() {
            val store = storeAt(dir, debounceMs = 60_000L) // 60 s window
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)

            store.flushDueMaps() // window has not elapsed
            assertFalse(dir.resolve("maps/${state.id}.json").toFile().exists(),
                "File must not be written before debounce window")
        }

        @Test
        fun `map is flushed when debounce window has elapsed`() {
            val store = storeAt(dir, debounceMs = 0L) // instant window
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)

            store.flushDueMaps()
            assertTrue(dir.resolve("maps/${state.id}.json").toFile().exists(),
                "File must be written once debounce window has elapsed")
        }

        @Test
        fun `mutation resets the debounce timer`() {
            val store = storeAt(dir, debounceMs = 60_000L)
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)
            Thread.sleep(10)

            // Second mutation resets the timestamp
            repo.save(state.copy())
            store.flushDueMaps() // still within the new window
            assertFalse(dir.resolve("maps/${state.id}.json").toFile().exists(),
                "File must not be written because timer was reset")
        }

        @Test
        fun `flushAllDirtyMaps bypasses the debounce window`() {
            val store = storeAt(dir, debounceMs = 60_000L)
            val repo = JsonMapStateRepository(store)
            val state = createStateWithLandmark()
            repo.save(state)

            store.flushAllDirtyMaps() // force-flush ignores window
            assertTrue(dir.resolve("maps/${state.id}.json").toFile().exists(),
                "flushAllDirtyMaps must write immediately regardless of debounce")
        }
    }
}

