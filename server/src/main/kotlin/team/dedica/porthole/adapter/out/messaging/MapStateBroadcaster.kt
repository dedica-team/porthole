package team.dedica.porthole.adapter.out.messaging
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.QualityMetric
import java.util.UUID

@Component
class MapStateBroadcaster(private val messaging: SimpMessagingTemplate) : BroadcastPort {

    // Snapshots are built synchronously on the caller's thread before handing off to the
    // async dispatcher, preventing ConcurrentModificationException from concurrent state writes.

    override fun send(sessionId: UUID, state: SessionState) =
        sendAsync("/topic/map/$sessionId", MapStateBroadcastDto.from(state))

    override fun sendMatrix(sessionId: UUID, matrix: CollaboratorMatrix) {
        val snapshot = CollaboratorMatrix(
            name = matrix.name,
            entries = matrix.entries.entries.associate { (k, v) -> k to v.toMap().toMutableMap() }.toMutableMap(),
        )
        sendAsync("/topic/map/$sessionId/matrix", snapshot)
    }

    override fun sendMetrics(sessionId: UUID, metrics: Map<UUID, QualityMetric>) =
        sendAsync("/topic/map/$sessionId/metrics", metrics.toMap())

    override fun sendChoreLists(sessionId: UUID, choreLists: Map<UUID, ChoreList>) =
        sendAsync("/topic/map/$sessionId/chore-lists", choreLists.toMap())

    override fun sendGreenkeepingRotations(sessionId: UUID, rotations: Map<UUID, GreenkeepingRotation>) =
        sendAsync("/topic/map/$sessionId/greenkeeping-rotations", rotations.toMap())

    @Async
    fun sendAsync(destination: String, payload: Any) {
        messaging.convertAndSend(destination, payload)
    }
}
