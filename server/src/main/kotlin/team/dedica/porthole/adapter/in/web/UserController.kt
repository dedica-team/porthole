package team.dedica.porthole.adapter.`in`.web

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.port.UserPort

data class ChangeUsernameRequest(val username: String)
data class ChangeUsernameResponse(val username: String)

@RestController
@RequestMapping("/api/users")
class UserController(private val userRepository: UserPort) {

    @PatchMapping("/me/username")
    fun changeUsername(
        @AuthenticationPrincipal principal: PortholePrincipal?,
        @RequestBody request: ChangeUsernameRequest,
    ): ResponseEntity<ChangeUsernameResponse> {
        principal ?: return ResponseEntity.status(401).build()
        val trimmed = request.username.trim()
        require(trimmed.length >= 3) { "Username must be at least 3 characters" }
        val existing = userRepository.findByUsername(trimmed)
        if (existing != null && existing.id != principal.userId) {
            return ResponseEntity.status(409).build()
        }
        val user = userRepository.findById(principal.userId)
            ?: return ResponseEntity.status(401).build()
        userRepository.save(user.copy(username = trimmed))
        return ResponseEntity.ok(ChangeUsernameResponse(trimmed))
    }
}
