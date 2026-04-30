package team.dedica.porthole.adapter.out.persistence
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import team.dedica.porthole.domain.*
import java.nio.file.Path
import java.util.UUID
/**
 * Persistence round-trip tests for [ChoreList] inside [MapState].
 * Each test saves via one repo/store pair, then creates a *new* store
 * (simulating a restart) and reads back – proving true JSON round-trips.
 * flushAllDirtyMaps() is called explicitly because the @Scheduled flush
 * is not available outside of a Spring context.
 */
class ChoreListPersistenceTest {
    @TempDir
    lateinit var dir: Path
    private lateinit var mapper: com.fasterxml.jackson.databind.ObjectMapper
    @BeforeEach
    fun setUp() {
        mapper = JsonPersistenceConfig().persistenceObjectMapper()
    }
    private fun newStore() = JsonStore(mapper, dir.toAbsolutePath().toString(), 0L)
    private fun newRepo(store: JsonStore) = JsonMapStateRepository(store)
    private fun baseState(): MapState {
        val map = HexMap.createHexagonal(radius = 3, elevationFn = { 2 })
        val state = MapState(map = map)
        val landmark = Landmark(
            id = UUID.randomUUID().toString(),
            name = "Reception", ownerId = "p1",
            coordinate = HexCoordinate(0, 0), type = LandmarkType.KEEP,
        )
        state.landmarks[landmark.id] = landmark
        return state
    }
    /** Save via one store and flush, then reload from a fresh store (simulates restart). */
    private fun saveAndReload(state: MapState): MapState {
        val writeStore = newStore()
        newRepo(writeStore).save(state)
        writeStore.flushAllDirtyMaps()
        val readStore = newStore()
        return newRepo(readStore).findById(state.id)!!
    }
    @Test
    fun `saves and reloads chore list with all entry fields`() {
        val state = baseState()
        val landmarkId = state.landmarks.keys.first()
        val list = ChoreList(title = "Audit")
        list.entries[landmarkId] = ChoreEntry(
            landmarkId = landmarkId,
            state = ChoreEntryState.ONGOING,
            assigneeId = "u1",
            link = "https://wiki.example",
            note = "Check fridges",
        )
        state.choreLists[list.id] = list
        val reloaded = saveAndReload(state)
        val reloadedList = reloaded.choreLists[list.id]!!
        assertEquals("Audit", reloadedList.title)
        assertFalse(reloadedList.completed)
        val entry = reloadedList.entries[landmarkId]!!
        assertEquals(ChoreEntryState.ONGOING, entry.state)
        assertEquals("u1", entry.assigneeId)
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
}
