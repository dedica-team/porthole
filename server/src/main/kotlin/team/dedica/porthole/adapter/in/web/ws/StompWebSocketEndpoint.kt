package team.dedica.porthole.adapter.`in`.web.ws

import io.micronaut.http.MediaType
import io.micronaut.websocket.WebSocketSession
import io.micronaut.websocket.annotation.*
import org.slf4j.LoggerFactory
import team.dedica.porthole.adapter.out.messaging.StompBroker

/**
 * STOMP 1.2 over raw WebSocket at `/ws-native`.
 *
 * The browser client (`@stomp/stompjs`) connects here and relies on the STOMP wire protocol;
 * Micronaut has no STOMP module on the classpath, so the handful of frames the client needs
 * (CONNECT, SUBSCRIBE, UNSUBSCRIBE, DISCONNECT) are handled directly. Message fan-out is
 * delegated to [StompBroker].
 *
 * Authentication is enforced during the HTTP upgrade by the security filter, so by the time a
 * frame arrives the session is already authenticated; no principal handling is needed here.
 */
@ServerWebSocket("/ws-native")
class StompWebSocketEndpoint(private val broker: StompBroker) {

    private val log = LoggerFactory.getLogger(StompWebSocketEndpoint::class.java)

    @OnOpen
    fun onOpen(session: WebSocketSession) {
        log.debug("STOMP session opened: {}", session.id)
    }

    @OnMessage
    fun onMessage(message: String, session: WebSocketSession) {
        // One WebSocket frame may carry several STOMP frames separated by NUL, interleaved
        // with optional EOL heartbeat newlines.
        message.split(NUL).forEach { chunk ->
            if (chunk.isNotBlank()) handleFrame(chunk, session)
        }
    }

    @OnClose
    fun onClose(session: WebSocketSession) {
        broker.removeSession(session)
        log.debug("STOMP session closed: {}", session.id)
    }

    @OnError
    fun onError(session: WebSocketSession, error: Throwable) {
        broker.removeSession(session)
        log.warn("STOMP session error ({}): {}", session.id, error.message)
    }

    private fun handleFrame(raw: String, session: WebSocketSession) {
        val headerEnd = raw.indexOf("\n\n")
        val headerBlock = if (headerEnd >= 0) raw.substring(0, headerEnd) else raw
        val lines = headerBlock.split('\n')

        val command = lines.firstOrNull()?.trim().orEmpty()
        val headers = lines.drop(1).mapNotNull { line ->
            val separator = line.indexOf(':')
            if (separator <= 0) null else line.substring(0, separator).trim() to line.substring(separator + 1).trim()
        }.toMap()

        when (command.uppercase()) {
            "CONNECT", "STOMP" -> send(session, CONNECTED_FRAME)

            "SUBSCRIBE" -> {
                val destination = headers["destination"] ?: return
                broker.subscribe(destination, session, headers["id"] ?: destination)
            }

            "UNSUBSCRIBE" -> headers["id"]?.let { broker.unsubscribe(it, session) }

            "DISCONNECT" -> {
                headers["receipt"]?.let { send(session, receiptFrame(it)) }
                session.close()
            }

            // The application never sends client-to-server messages; ignore anything else.
            else -> log.trace("Ignoring STOMP frame '{}'", command)
        }
    }

    private fun receiptFrame(receiptId: String): String =
        "RECEIPT\nreceipt-id:$receiptId\n\n\u0000"

    private fun send(session: WebSocketSession, frame: String) {
        session.sendAsync(frame, MediaType.TEXT_PLAIN_TYPE)
    }

    private companion object {
        const val NUL = '\u0000'

        // heart-beat:0,0 tells the client neither side needs to send heartbeats, avoiding the
        // need for a server-side heartbeat scheduler.
        const val CONNECTED_FRAME = "CONNECTED\nversion:1.2\nserver:porthole\nheart-beat:0,0\n\n\u0000"
    }
}
