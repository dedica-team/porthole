package team.dedica.porthole.adapter.out.messaging
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.MapState
import team.dedica.porthole.domain.QualityMetric

@Component
class MapStateBroadcaster(private val messaging: SimpMessagingTemplate) : BroadcastPort {

    @Async
    override fun send(mapId: String, state: MapState) {
        messaging.convertAndSend("/topic/map/$mapId", MapStateBroadcastDto.from(state))
    }

    @Async
    override fun sendMatrix(mapId: String, matrix: CollaboratorMatrix) {
        val snapshot = CollaboratorMatrix(
            name = matrix.name,
            entries = matrix.entries.entries.associate { (k, v) -> k to v.toMap().toMutableMap() }.toMutableMap(),
        )
        messaging.convertAndSend("/topic/map/$mapId/matrix", snapshot)
    }

    @Async
    override fun sendMetrics(mapId: String, metrics: Map<String, QualityMetric>) {
        messaging.convertAndSend("/topic/map/$mapId/metrics", metrics.toMap())
    }

    @Async
    override fun sendChoreLists(mapId: String, choreLists: Map<String, ChoreList>) {
        messaging.convertAndSend("/topic/map/$mapId/chore-lists", choreLists.toMap())
    }
}
