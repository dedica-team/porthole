package team.dedica.porthole.adapter.out.messaging

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.domain.MapState

@Component
class MapStateBroadcaster(private val messaging: SimpMessagingTemplate) : BroadcastPort {
    @Async
    override fun send(mapId: String, state: MapState) {
        messaging.convertAndSend("/topic/map/$mapId", MapStateBroadcastDto.from(state))
    }
}

