package team.dedica.porthole.adapter.out.persistence
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import team.dedica.porthole.domain.*
import java.nio.file.Path
import java.util.UUID
/**
 * Persistence round-trip tests for [ChoreList] inside [SessionState].
 * Each test saves via one repo/store pair, then creates a *new* store
 * (simulating a restart) and reads back – proving true JSON round-trips.
 * flushAllDirtyMaps() is called explicitly because the @Scheduled flush
 * is not available outside of a Spring context.
 */
class ChoreListPersistenceTest {
    @TempDir
    lateinit var dir: Path
    private lateinit var mapper: tools.jackson.databind.ObjectMapper
    @BeforeEach
    fun setUp() {
        mapper = JsonPersistenceConfig().persistenceObjectMapper()
    }
    private fun newStore() = JsonStore(mapper, dir.toAbsolutePath().toString(), 0L)
    private fun newRepo(store: JsonStore) = JsonSessionStateRepository(store)
    private fun baseState(): SessionState {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        val state = SessionState(map = map)
        val landmarkId = UUID.randomUUID()
        val landmark = Landmark(
            id = landmarkId,
            name = "Reception", ownerId = UUID.nameUUIDFromBytes("p1".toByteArray()),
            coordinate = HexCoordinate(0, 0), type = LandmarkType.KEEP,
        )
        state.landmarks[landmark.id] = landmark
        return state
    }
    /** Save via one store and flush, then reload from a fresh store (simulates restart). */
    private fun saveAndReload(state: SessionState): SessionState {
        val writeStore = newStore()
        newRepo(writeStore).save(state)
        writeStore.flushAllDirtyMaps()
        val readStore = newStore()
        return newRepo(readStore).findById(state.id)!!
    }
    @Test
    fun `saves and reloads chore list with all entry fields`() {
        val state = baseState()
        val landmarkUuid = state.landmarks.values.first().id
        val list = ChoreList(title = "Audit")
        list.entries[landmarkUuid] = ChoreEntry(
            landmarkId = landmarkUuid,
            state = ChoreEntryState.ONGOING,
            assigneeId = UUID.nameUUIDFromBytes("u1".toByteArray()),
            link = "https://wiki.example",
            note = "Check fridges",
        )
        state.choreLists[list.id] = list
        val reloaded = saveAndReload(state)
        val reloadedList = reloaded.choreLists[list.id]!!
        assertEquals("Audit", reloadedList.title)
        assertFalse(reloadedList.completed)
        val entry = reloadedList.entries[landmarkUuid]!!
        assertEquals(ChoreEntryState.ONGOING, entry.state)
        assertEquals(UUID.nameUUIDFromBytes("u1".toByteArray()), entry.assigneeId)
        assertEquals("https://wiki.example", entry.link)
        assertEquals("Check fridges", entry.note)
    }
    @Test
    fun `saves and reloads completed chore list`() {
        val state = baseState()
        val list = ChoreList(title = "Done List", completed = true)
        state.choreLists[list.id] = list
        val reloaded = saveAndReload(state)
        assertTrue(reloaded.choreLists[list.id]!!.completed)
    }
    @Test
    fun `empty choreLists map round-trips correctly`() {
        val state = baseState()
        val reloaded = saveAndReload(state)
        assertTrue(reloaded.choreLists.isEmpty())
    }

    @Test
    fun `saves and reloads chore list description`() {
        val state = baseState()
        val list = ChoreList(title = "Inspection", description = "Check all equipment thoroughly")
        state.choreLists[list.id] = list
        val reloaded = saveAndReload(state)
        assertEquals("Check all equipment thoroughly", reloaded.choreLists[list.id]!!.description)
    }

    @Test
    fun `null description round-trips as null`() {
        val state = baseState()
        val list = ChoreList(title = "Simple", description = null)
        state.choreLists[list.id] = list
        val reloaded = saveAndReload(state)
        assertNull(reloaded.choreLists[list.id]!!.description)
    }
}
