package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpStatus
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.UserPort
import java.util.UUID

class UserControllerTest {

    private val userRepository = mock<UserPort>()
    private lateinit var controller: UserController

    private val userId = UUID.nameUUIDFromBytes("alice".toByteArray())
    private val otherId = UUID.nameUUIDFromBytes("bob".toByteArray())
    private val principal = PortholePrincipal(userId = userId, username = "alice")
    private val aliceRecord = UserRecord(id = userId, username = "alice")

    @BeforeEach
    fun setUp() {
        controller = UserController(userRepository)
        whenever(userRepository.findById(userId)).thenReturn(aliceRecord)
    }

    private fun body(response: io.micronaut.http.HttpResponse<*>): ChangeUsernameResponse =
        response.body.get() as ChangeUsernameResponse

    @Test
    fun `returns updated username on success`() {
        whenever(userRepository.findByUsername("alice2")).thenReturn(null)

        val response = controller.changeUsername(principal, ChangeUsernameRequest("alice2"))

        assertEquals(HttpStatus.OK, response.status)
        assertEquals("alice2", body(response).username)
        verify(userRepository).save(aliceRecord.copy(username = "alice2"))
    }

    @Test
    fun `trims whitespace from username`() {
        whenever(userRepository.findByUsername("alice2")).thenReturn(null)

        val response = controller.changeUsername(principal, ChangeUsernameRequest("  alice2  "))

        assertEquals(HttpStatus.OK, response.status)
        assertEquals("alice2", body(response).username)
        verify(userRepository).save(aliceRecord.copy(username = "alice2"))
    }

    @Test
    fun `allows user to keep their own username`() {
        whenever(userRepository.findByUsername("alice")).thenReturn(aliceRecord)

        val response = controller.changeUsername(principal, ChangeUsernameRequest("alice"))

        assertEquals(HttpStatus.OK, response.status)
        verify(userRepository).save(aliceRecord)
    }

    @Test
    fun `returns 409 when username is taken by another user`() {
        val otherRecord = UserRecord(id = otherId, username = "alice2")
        whenever(userRepository.findByUsername("alice2")).thenReturn(otherRecord)

        val response = controller.changeUsername(principal, ChangeUsernameRequest("alice2"))

        assertEquals(HttpStatus.CONFLICT, response.status)
        verify(userRepository, never()).save(any())
    }

    @Test
    fun `throws IllegalArgumentException when username is too short`() {
        whenever(userRepository.findByUsername("ab")).thenReturn(null)

        assertThrows(IllegalArgumentException::class.java) {
            controller.changeUsername(principal, ChangeUsernameRequest("ab"))
        }
        verify(userRepository, never()).save(any())
    }

    @Test
    fun `returns 401 when not authenticated`() {
        val response = controller.changeUsername(null, ChangeUsernameRequest("alice2"))

        assertEquals(HttpStatus.UNAUTHORIZED, response.status)
        verify(userRepository, never()).save(any())
    }

    @Test
    fun `returns 401 when authenticated user not found in repository`() {
        whenever(userRepository.findById(userId)).thenReturn(null)
        whenever(userRepository.findByUsername("alice2")).thenReturn(null)

        val response = controller.changeUsername(principal, ChangeUsernameRequest("alice2"))

        assertEquals(HttpStatus.UNAUTHORIZED, response.status)
        verify(userRepository, never()).save(any())
    }
}
