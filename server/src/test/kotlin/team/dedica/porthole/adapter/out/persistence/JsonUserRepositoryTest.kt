package team.dedica.porthole.adapter.out.persistence

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import team.dedica.porthole.adapter.out.repository.UserRecord
import java.nio.file.Path

class JsonUserRepositoryTest {

    private val config = JsonPersistenceConfig()
    private val mapper = config.persistenceObjectMapper()

    private fun storeAt(dir: Path) = JsonStore(mapper, dir.toAbsolutePath().toString(), debounceMs = 0L)
    private fun repoAt(dir: Path) = JsonUserRepository(storeAt(dir))

    @Test
    fun `saved user can be found by username`(@TempDir dir: Path) {
        val repo = repoAt(dir)
        repo.save(UserRecord(id = "u1", username = "alice", githubId = "gh-alice"))
        assertNotNull(repo.findByUsername("alice"))
        assertNull(repo.findByUsername("bob"))
    }

    @Test
    fun `saved user can be found by githubId`(@TempDir dir: Path) {
        val repo = repoAt(dir)
        repo.save(UserRecord(id = "u1", username = "alice", githubId = "gh-42"))
        assertNotNull(repo.findByGithubId("gh-42"))
        assertNull(repo.findByGithubId("gh-99"))
    }

    @Test
    fun `user survives a restart`(@TempDir dir: Path) {
        val store = storeAt(dir)
        val repo = JsonUserRepository(store)
        repo.save(UserRecord(id = "u1", username = "alice", githubId = "gh-alice", email = "alice@example.com"))
        store.saveUsersIfDirty()

        val loaded = repoAt(dir).findByUsername("alice")
        assertNotNull(loaded)
        assertEquals("gh-alice", loaded!!.githubId)
        assertEquals("alice@example.com", loaded.email)
    }

    @Test
    fun `update overwrites existing user`(@TempDir dir: Path) {
        val store = storeAt(dir)
        val repo = JsonUserRepository(store)
        repo.save(UserRecord(id = "u1", username = "alice", githubId = "gh-alice"))
        repo.save(UserRecord(id = "u1", username = "alice", githubId = "gh-alice", avatarUrl = "https://example.com/avatar.png"))
        store.saveUsersIfDirty()

        val loaded = repoAt(dir).findByUsername("alice")!!
        assertEquals("https://example.com/avatar.png", loaded.avatarUrl)
    }

    @Test
    fun `no users file written when nothing saved`(@TempDir dir: Path) {
        val store = storeAt(dir)
        store.saveUsersIfDirty()
        assertFalse(dir.resolve("users.json").toFile().exists())
    }
}

