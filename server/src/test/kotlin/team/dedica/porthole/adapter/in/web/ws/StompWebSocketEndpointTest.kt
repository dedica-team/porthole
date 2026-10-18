package team.dedica.porthole.adapter.`in`.web.ws

import io.micronaut.runtime.server.EmbeddedServer
import io.micronaut.test.extensions.junit5.annotation.MicronautTest
import jakarta.inject.Inject
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.`in`.web.security.JwtTokenProvider
import team.dedica.porthole.adapter.out.messaging.StompBroker
import java.net.URI
import java.net.http.HttpClient
import java.net.http.WebSocket
import java.util.*
import java.util.concurrent.CompletionStage
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * End-to-end test of the STOMP-over-WebSocket endpoint at `/ws-native`.
 *
 * Verifies that an authenticated handshake is accepted, the STOMP `CONNECT`/`SUBSCRIBE`
 * handshake succeeds, and that a payload published through [StompBroker] is delivered to the
 * subscriber as a `MESSAGE` frame.
 */
@MicronautTest
class StompWebSocketEndpointTest {

    @Inject
    lateinit var server: EmbeddedServer

    @Inject
    lateinit var jwtTokenProvider: JwtTokenProvider

    @Inject
    lateinit var broker: StompBroker

    @Test
    fun `authenticated client connects, subscribes and receives a published message`() {
        val token = jwtTokenProvider.generateToken(UUID.randomUUID(), "ws-user")
        val received = LinkedBlockingQueue<String>()

        val webSocket = HttpClient.newHttpClient()
            .newWebSocketBuilder()
            .header("Authorization", "Bearer $token")
            .buildAsync(URI.create("ws://localhost:${server.port}/ws-native"), collectingListener(received))
            .get(10, TimeUnit.SECONDS)

        webSocket.sendText("CONNECT\naccept-version:1.2\nhost:localhost\n\n\u0000", true).join()
        val connected = received.poll(10, TimeUnit.SECONDS)
        assertNotNull(connected, "expected a CONNECTED frame")
        assertTrue(connected!!.startsWith("CONNECTED"), "expected CONNECTED, got: $connected")

        val destination = "/topic/map/${UUID.randomUUID()}"
        webSocket.sendText("SUBSCRIBE\nid:sub-0\ndestination:$destination\n\n\u0000", true).join()

        // Give the SUBSCRIBE frame a moment to register before publishing.
        Thread.sleep(200)
        broker.publish(destination, mapOf("value" to 42))

        val message = received.poll(10, TimeUnit.SECONDS)
        assertNotNull(message, "expected a MESSAGE frame")
        assertTrue(message!!.startsWith("MESSAGE"), "expected MESSAGE, got: $message")
        assertTrue(message.contains("destination:$destination"), "missing destination header: $message")
        assertTrue(message.contains("\"value\":42"), "missing payload body: $message")

        webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "done").join()
    }

    private fun collectingListener(sink: LinkedBlockingQueue<String>) = object : WebSocket.Listener {
        private val buffer = StringBuilder()

        override fun onText(webSocket: WebSocket, data: CharSequence, last: Boolean): CompletionStage<*>? {
            buffer.append(data)
            if (last) {
                sink.add(buffer.toString())
                buffer.setLength(0)
            }
            webSocket.request(1)
            return null
        }
    }
}
