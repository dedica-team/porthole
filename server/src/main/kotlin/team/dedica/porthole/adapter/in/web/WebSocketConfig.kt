package team.dedica.porthole.adapter.`in`.web

import org.springframework.context.annotation.Configuration
import org.springframework.messaging.simp.config.ChannelRegistration
import org.springframework.messaging.simp.config.MessageBrokerRegistry
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker
import org.springframework.web.socket.config.annotation.StompEndpointRegistry
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer
import team.dedica.porthole.adapter.`in`.web.security.WebSocketAuthInterceptor
import team.dedica.porthole.adapter.`in`.web.security.WebSocketHandshakeAuthInterceptor
import team.dedica.porthole.config.PortholeAuthProperties

@Configuration
@EnableWebSocketMessageBroker
class WebSocketConfig(
    private val webSocketAuthInterceptor: WebSocketAuthInterceptor,
    private val webSocketHandshakeAuthInterceptor: WebSocketHandshakeAuthInterceptor,
    private val props: PortholeAuthProperties,
) : WebSocketMessageBrokerConfigurer {

    override fun configureMessageBroker(registry: MessageBrokerRegistry) {
        registry.enableSimpleBroker("/topic")
        registry.setApplicationDestinationPrefixes("/app")
    }

    override fun registerStompEndpoints(registry: StompEndpointRegistry) {
        val origins = props.allowedOrigins.split(",").map { it.trim() }.toTypedArray()

        // SockJS fallback endpoint (for environments that need it)
        registry.addEndpoint("/ws")
            .setAllowedOrigins(*origins)
            .addInterceptors(webSocketHandshakeAuthInterceptor)
            .withSockJS()

        // Native WebSocket endpoint used by the Vite/browser client
        registry.addEndpoint("/ws-native")
            .setAllowedOrigins(*origins)
            .addInterceptors(webSocketHandshakeAuthInterceptor)
    }

    override fun configureClientInboundChannel(registration: ChannelRegistration) {
        registration.interceptors(webSocketAuthInterceptor)
    }
}