package team.dedica.porthole.adapter.out.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import io.micronaut.http.MediaType
import io.micronaut.websocket.WebSocketSession
import jakarta.inject.Singleton
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap

/**
 * Minimal in-memory STOMP message broker.
 *
 * Replaces the former Spring `SimpMessagingTemplate` + `@EnableWebSocketMessageBroker`
 * "simple broker" (destination prefix `/topic`). It keeps a registry of the client
 * subscriptions per destination and pushes JSON payloads as STOMP `MESSAGE` frames, so the
 * existing `@stomp/stompjs` browser client keeps working unchanged.
 *
 * The broker only broadcasts server-to-client frames; client-initiated `SEND` frames are not
 * used by the application and therefore ignored by the endpoint.
 */
@Singleton
class StompBroker(private val objectMapper: ObjectMapper) {

    private val log = LoggerFactory.getLogger(StompBroker::class.java)

    /** session -> (subscription id -> destination supplied by the client's SUBSCRIBE frame). */
    private val subscriptions = ConcurrentHashMap<WebSocketSession, MutableMap<String, String>>()

    fun subscribe(destination: String, session: WebSocketSession, subscriptionId: String) {
        subscriptions.computeIfAbsent(session) { ConcurrentHashMap() }[subscriptionId] = destination
    }

    fun unsubscribe(subscriptionId: String, session: WebSocketSession) {
        subscriptions[session]?.remove(subscriptionId)
    }

    fun removeSession(session: WebSocketSession) {
        subscriptions.remove(session)
    }

    /** Serializes [payload] and fans it out to every session subscribed to [destination]. */
    fun publish(destination: String, payload: Any) {
        if (subscriptions.isEmpty()) return

        val body = try {
            objectMapper.writeValueAsString(payload)
        } catch (e: Exception) {
            log.error("Failed to serialize message for {}: {}", destination, e.message, e)
            return
        }

        subscriptions.forEach { (session, destinationsBySubscription) ->
            if (session.isOpen) {
                destinationsBySubscription.forEach { (subscriptionId, subscribedDestination) ->
                    if (subscribedDestination == destination) {
                        try {
                            session.sendAsync(buildMessageFrame(destination, subscriptionId, body), MediaType.TEXT_PLAIN_TYPE)
                        } catch (e: Exception) {
                            log.warn("Failed to publish to {} (session {}): {}", destination, session.id, e.message)
                        }
                    }
                }
            }
        }
    }

    private fun buildMessageFrame(destination: String, subscriptionId: String, body: String): String {
        // content-length is a byte count (UTF-8), not a character count.
        val contentLength = body.toByteArray(Charsets.UTF_8).size
        return buildString {
            append("MESSAGE\n")
            append("destination:").append(destination).append('\n')
            append("subscription:").append(subscriptionId).append('\n')
            append("content-type:application/json;charset=utf-8\n")
            append("content-length:").append(contentLength).append('\n')
            append('\n')
            append(body)
            append('\u0000')
        }
    }
}
