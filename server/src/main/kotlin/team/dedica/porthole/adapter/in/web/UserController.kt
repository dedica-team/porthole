package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Patch

import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.port.UserPort

data class ChangeUsernameRequest(val username: String)
data class ChangeUsernameResponse(val username: String)

@Controller("/api/users")
class UserController(private val userRepository: UserPort) {

    @Patch("/me/username")
    fun changeUsername(
         principal: PortholePrincipal?,
        @Body request: ChangeUsernameRequest,
    ): HttpResponse<*> {
        principal ?: return HttpResponse.unauthorized<Any>()
        val trimmed = request.username.trim()
        require(trimmed.length >= 3) { "Username must be at least 3 characters" }
        val existing = userRepository.findByUsername(trimmed)
        if (existing != null && existing.id != principal.userId) {
            return HttpResponse.status<Any>(HttpStatus.CONFLICT)
        }
        val user = userRepository.findById(principal.userId)
            ?: return HttpResponse.unauthorized<Any>()
        userRepository.save(user.copy(username = trimmed))
        return HttpResponse.ok(ChangeUsernameResponse(trimmed))
    }
}
