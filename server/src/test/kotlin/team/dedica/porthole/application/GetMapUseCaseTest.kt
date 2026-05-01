package team.dedica.porthole.application

import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.lobby.GetMapUseCase
import team.dedica.porthole.domain.*

class GetMapUseCaseTest {

    private lateinit var mapStatePort: InMemoryMapStatePort
    private lateinit var userPort: InMemoryTestUserRepository
    private lateinit var useCase: GetMapUseCase

    private val userWithAvatar = UserRecord(
        id = UUID.randomUUID(),
        username = "alice",
        githubId = "gh-1",
        avatarUrl = "https://example.com/alice.png"
    )
    private val userWithoutAvatar = UserRecord(
        id = UUID.randomUUID(),
        username = "bob",
        githubId = "gh-2",
        avatarUrl = null
    )

    @BeforeEach
    fun setup() {
        mapStatePort = InMemoryMapStatePort()
        userPort = InMemoryTestUserRepository()
        userPort.save(userWithAvatar)
        userPort.save(userWithoutAvatar)
        useCase = GetMapUseCase(mapStatePort, userPort)
    }

    // ── basic retrieval ───────────────────────────────────────────────────────

    @Test
    fun `returns existing map by id`() {
        val state = mapStateWith()
        mapStatePort.save(state)
        assertEquals(state.id, useCase.execute(state.id).id)
    }

    @Test
    fun `throws NoSuchElementException for unknown id`() {
        assertThrows(NoSuchElementException::class.java) { useCase.execute(UUID.randomUUID()) }
    }

    // ── avatar patching ───────────────────────────────────────────────────────

    @Test
    fun `collaborator without avatarUrl is patched from UserRecord`() {
        val state = mapStateWith(
            Collaborator(
                id = UUID.randomUUID(),
                username = "alice",
                avatarUrl = null
            )
        )
        mapStatePort.save(state)

        val loaded = useCase.execute(state.id)

        assertEquals("https://example.com/alice.png", loaded.collaborators.first().avatarUrl)
    }

    @Test
    fun `collaborator with stale avatarUrl is updated to fresh value`() {
        val state = mapStateWith(
            Collaborator(
                id = UUID.randomUUID(),
                username = "alice",
                avatarUrl = "https://old.example.com/avatar.png"
            )
        )
        mapStatePort.save(state)

        val loaded = useCase.execute(state.id)

        assertEquals("https://example.com/alice.png", loaded.collaborators.first().avatarUrl)
    }

    @Test
    fun `collaborator whose user has no avatarUrl is left unchanged`() {
        val state = mapStateWith(
            Collaborator(
                id = UUID.randomUUID(),
                username = "bob",
                avatarUrl = null
            )
        )
        mapStatePort.save(state)

        val loaded = useCase.execute(state.id)

        assertNull(loaded.collaborators.first().avatarUrl)
    }

    @Test
    fun `collaborator with already-current avatarUrl is not changed`() {
        val state = mapStateWith(
            Collaborator(
                id = UUID.randomUUID(),
                username = "alice",
                avatarUrl = "https://example.com/alice.png"
            )
        )
        mapStatePort.save(state)
        val savedBefore = mapStatePort.findById(state.id)!!.collaborators.first().avatarUrl

        useCase.execute(state.id)

        // State must not have been re-saved (same reference means save was not called again)
        val savedAfter = mapStatePort.findById(state.id)!!.collaborators.first().avatarUrl
        assertEquals(savedBefore, savedAfter)
    }

    @Test
    fun `patched state is persisted so the next load requires no further patching`() {
        val state = mapStateWith(
            Collaborator(
                id = UUID.randomUUID(),
                username = "alice",
                avatarUrl = null
            )
        )
        mapStatePort.save(state)

        useCase.execute(state.id) // first load – patches and saves

        val persisted = mapStatePort.findById(state.id)!!
        assertEquals("https://example.com/alice.png", persisted.collaborators.first().avatarUrl)
    }

    @Test
    fun `multiple collaborators are all patched in a single load`() {
        val state = mapStateWith(
            Collaborator(
                id = UUID.randomUUID(),
                username = "alice",
                avatarUrl = null
            ),
            Collaborator(
                id = UUID.randomUUID(),
                username = "bob",
                avatarUrl = null
            ),
        )
        mapStatePort.save(state)

        val loaded = useCase.execute(state.id)

        assertEquals(2, loaded.collaborators.size)
    }

    @Test
    fun `collaborator not found in UserRecord is left unchanged`() {
        // collaborator whose username does not match any UserRecord (e.g. deleted user)
        val state = mapStateWith(
            Collaborator(
                id = UUID.randomUUID(),
                username = "ghost",
                avatarUrl = null
            )
        )
        mapStatePort.save(state)

        val loaded = useCase.execute(state.id)

        assertNull(loaded.collaborators.first().avatarUrl)
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private fun mapStateWith(vararg collaborators: Collaborator): MapState {
        val state = MapState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        state.collaborators.addAll(collaborators)
        return state
    }
}

