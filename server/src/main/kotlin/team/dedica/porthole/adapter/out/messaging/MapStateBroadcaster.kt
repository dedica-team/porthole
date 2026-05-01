package team.dedica.porthole.adapter.out.messaging
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.QualityMetric
import java.util.UUID

@Component
class MapStateBroadcaster(private val messaging: SimpMessagingTemplate) : BroadcastPort {

    @Async
    override fun send(mapId: UUID, state: SessionState) {
        messaging.convertAndSend("/topic/map/$mapId", MapStateBroadcastDto.from(state))
    }

    @Async
    override fun sendMatrix(mapId: UUID, matrix: CollaboratorMatrix) {
        val snapshot = CollaboratorMatrix(
            name = matrix.name,
            entries = matrix.entries.entries.associate { (k, v) -> k to v.toMap().toMutableMap() }.toMutableMap(),
        )
        messaging.convertAndSend("/topic/map/$mapId/matrix", snapshot)
    }

    @Async
    override fun sendMetrics(mapId: UUID, metrics: Map<UUID, QualityMetric>) {
        messaging.convertAndSend("/topic/map/$mapId/metrics", metrics.toMap())
    }

    @Async
    override fun sendChoreLists(mapId: UUID, choreLists: Map<UUID, ChoreList>) {
        messaging.convertAndSend("/topic/map/$mapId/chore-lists", choreLists.toMap())
    }
}
