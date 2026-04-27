package team.dedica.porthole.adapter.`in`.web.security

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.http.server.ServletServerHttpRequest
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import team.dedica.porthole.application.port.UserWritePort

@Component
class WebSocketHandshakeAuthInterceptor(
    private val jwtTokenProvider: JwtTokenProvider,
    private val userRepository: UserWritePort,
    private val authCookieService: AuthCookieService,
) : HandshakeInterceptor {

    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        val servletRequest = (request as? ServletServerHttpRequest)?.servletRequest ?: return unauthorized(response)
        val token = resolveToken(servletRequest) ?: return unauthorized(response)
        val claims = runCatching { jwtTokenProvider.getTokenClaims(token) }.getOrNull() ?: return unauthorized(response)
        val userRecord = userRepository.findById(claims.userId) ?: return unauthorized(response)

        attributes[USER_ID_ATTR] = userRecord.id
        attributes[USERNAME_ATTR] = userRecord.username
        return true
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?,
    ) = Unit

    private fun resolveToken(request: HttpServletRequest): String? {
        val bearer = request.getHeader("Authorization")
            ?.takeIf { it.startsWith("Bearer ") }
            ?.removePrefix("Bearer ")
            ?.trim()
        return bearer?.takeIf { it.isNotBlank() } ?: authCookieService.resolveToken(request)
    }

    private fun unauthorized(response: ServerHttpResponse): Boolean {
        response.setStatusCode(HttpStatus.UNAUTHORIZED)
        return false
    }

    companion object {
        const val USER_ID_ATTR = "porthole.auth.userId"
        const val USERNAME_ATTR = "porthole.auth.username"
    }
}

