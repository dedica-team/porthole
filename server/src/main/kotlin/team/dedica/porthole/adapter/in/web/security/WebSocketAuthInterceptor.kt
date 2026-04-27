package team.dedica.porthole.adapter.`in`.web.security

import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.User
import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.UserWritePort

/**
 * Validates WebSocket auth for STOMP CONNECT frames.
 * Prefers the authenticated HTTP handshake session set by [WebSocketHandshakeAuthInterceptor]
 * and falls back to a bearer token in the CONNECT frame for backward compatibility.
 */
@Component
class WebSocketAuthInterceptor(
    private val jwtTokenProvider: JwtTokenProvider,
    private val userRepository: UserWritePort,
) : ChannelInterceptor {

    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*> {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java)
            ?: return message

        if (accessor.command == StompCommand.CONNECT) {
            val sessionUserId = accessor.sessionAttributes?.get(WebSocketHandshakeAuthInterceptor.USER_ID_ATTR) as? String
            val sessionUsername = accessor.sessionAttributes?.get(WebSocketHandshakeAuthInterceptor.USERNAME_ATTR) as? String
            if (!sessionUserId.isNullOrBlank() && !sessionUsername.isNullOrBlank()) {
                val userRecord = userRepository.findById(sessionUserId)
                    ?: throw SecurityException("Unauthorized WebSocket connection: unknown user")
                val authorities = listOf(SimpleGrantedAuthority("ROLE_USER"))
                val principal = User(userRecord.username, "", authorities)
                val auth = UsernamePasswordAuthenticationToken(principal, null, authorities)
                accessor.user = auth
                return message
            }

            val authHeader = accessor.getFirstNativeHeader("Authorization")
            val token = authHeader?.removePrefix("Bearer ")?.trim()
            val claims = token?.let { runCatching { jwtTokenProvider.getTokenClaims(it) }.getOrNull() }

            if (token.isNullOrBlank() || claims == null) {
                throw SecurityException("Unauthorized WebSocket connection: missing or invalid token")
            }

            val userRecord = userRepository.findById(claims.userId)
                ?: throw SecurityException("Unauthorized WebSocket connection: unknown user")

            val authorities = listOf(SimpleGrantedAuthority("ROLE_USER"))
            val principal = User(userRecord.username, "", authorities)
            val auth = UsernamePasswordAuthenticationToken(principal, null, authorities)
            accessor.user = auth
        }

        return message
    }
}

