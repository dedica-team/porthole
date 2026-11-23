package team.dedica.porthole.adapter.out.messaging

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import java.util.UUID

class ProcessBroadcastTest {
    @Test
    fun `publishes only a non-sensitive invalidation signal to the session topic`() {
        val broker: StompBroker = mock()
        val sessionId = UUID.randomUUID()
        MapStateBroadcaster(broker).sendProcesses(sessionId)
        val payload = argumentCaptor<Any>()
        verify(broker).publish(eq("/topic/map/$sessionId/processes"), payload.capture())
        assertEquals(mapOf("invalidated" to true), payload.firstValue)
    }
}