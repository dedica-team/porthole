package team.dedica.porthole.adapter.`in`.web

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.InMemoryTestUserRepository
import java.util.UUID

class KeycloakOAuthServiceTest {

    private lateinit var userRepository: InMemoryTestUserRepository
    private lateinit var service: KeycloakOAuthService

    @BeforeEach
    fun setUp() {
        userRepository = InMemoryTestUserRepository()
        service = KeycloakOAuthService(userRepository)
    }

    @Test
    fun `upsertUser creates new user when neither keycloakId nor username exists`() {
        val info = KeycloakUserInfo(
            keycloakId = "kc-123",
            username = "testuser",
            email = "test@example.com",
            avatarUrl = "https://example.com/pic.png",
        )

        val user = service.upsertUser(info)

        assertEquals("testuser", user.username)
        assertEquals("kc-123", user.keycloakId)
        assertEquals("test@example.com", user.email)
        assertEquals("https://example.com/pic.png", user.avatarUrl)
        assertNotNull(userRepository.findByUsername("testuser"))
        assertNotNull(userRepository.findByKeycloakId("kc-123"))
    }

    @Test
    fun `upsertUser updates existing user when keycloakId matches`() {
        val existing = UserRecord(
            id = UUID.randomUUID(),
            username = "myuser",
            keycloakId = "kc-123",
            email = "old@example.com",
            avatarUrl = null,
        )
        userRepository.save(existing)

        val info = KeycloakUserInfo(
            keycloakId = "kc-123",
            username = "different-username-ignored-if-keycloakId-matches",
            email = "new@example.com",
            avatarUrl = "https://example.com/new.png",
        )

        val user = service.upsertUser(info)

        assertEquals(existing.id, user.id)
        assertEquals("myuser", user.username)
        assertEquals("kc-123", user.keycloakId)
        assertEquals("new@example.com", user.email)
        assertEquals("https://example.com/new.png", user.avatarUrl)
    }

    @Test
    fun `upsertUser links keycloakId when username matches and user has no keycloakId`() {
        val existing = UserRecord(
            id = UUID.randomUUID(),
            username = "testuser",
            githubId = "gh-1",
            keycloakId = null,
            email = "initial@example.com",
        )
        userRepository.save(existing)

        val info = KeycloakUserInfo(
            keycloakId = "kc-new",
            username = "testuser",
            email = "testuser@example.com",
            avatarUrl = "https://example.com/pic.png",
        )

        val user = service.upsertUser(info)

        assertEquals(existing.id, user.id)
        assertEquals("testuser", user.username)
        assertEquals("kc-new", user.keycloakId)
        assertEquals("testuser@example.com", user.email)
        assertEquals("https://example.com/pic.png", user.avatarUrl)
    }

    @Test
    fun `upsertUser links keycloakId when username and email match existing user even with old keycloakId`() {
        val existing = UserRecord(
            id = UUID.randomUUID(),
            username = "testuser",
            keycloakId = "kc-old-random-uuid",
            email = "testuser@example.com",
            avatarUrl = null,
        )
        userRepository.save(existing)

        val info = KeycloakUserInfo(
            keycloakId = "kc-new-uuid",
            username = "testuser",
            email = "testuser@example.com",
            avatarUrl = "https://example.com/pic.png",
        )

        val user = service.upsertUser(info)

        assertEquals(existing.id, user.id)
        assertEquals("testuser", user.username)
        assertEquals("kc-new-uuid", user.keycloakId)
        assertEquals("testuser@example.com", user.email)
        assertEquals("https://example.com/pic.png", user.avatarUrl)
    }

    @Test
    fun `upsertUser creates suffixed username on collision with different keycloak account and different email`() {
        val existing = UserRecord(
            id = UUID.randomUUID(),
            username = "testuser",
            keycloakId = "kc-other",
            email = "other@example.com",
        )
        userRepository.save(existing)

        val info = KeycloakUserInfo(
            keycloakId = "kc-new",
            username = "testuser",
            email = "new@example.com",
            avatarUrl = null,
        )

        val user = service.upsertUser(info)

        assertNotEquals(existing.id, user.id)
        assertEquals("testuser-1", user.username)
        assertEquals("kc-new", user.keycloakId)
        assertEquals("new@example.com", user.email)
    }
}
