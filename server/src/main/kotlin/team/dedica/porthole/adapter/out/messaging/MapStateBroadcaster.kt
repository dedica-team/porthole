package team.dedica.porthole.adapter.out.messaging

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.QualityMetric
import java.util.UUID

@Singleton
class MapStateBroadcaster(private val broker: StompBroker) : BroadcastPort {

    // Snapshots are built synchronously on the caller's thread before handing off to the
    // async dispatcher, preventing ConcurrentModificationException from concurrent state writes.

    override fun send(sessionId: UUID, state: SessionState) =
        broker.publish("/topic/map/$sessionId", MapStateBroadcastDto.from(state))

    override fun sendMatrix(sessionId: UUID, matrix: CollaboratorMatrix) {
        val snapshot = CollaboratorMatrix(
            name = matrix.name,
            collaborators = matrix.collaborators.toMutableList(),
            entries = matrix.entries.entries.associate { (k, v) -> k to v.toMap().toMutableMap() }.toMutableMap(),
        )
        broker.publish("/topic/map/$sessionId/matrix", snapshot)
    }

    override fun sendMetrics(sessionId: UUID, metrics: Map<UUID, QualityMetric>) =
        broker.publish("/topic/map/$sessionId/metrics", metrics.toMap())

    override fun sendChoreLists(sessionId: UUID, choreLists: Map<UUID, ChoreList>) =
        broker.publish("/topic/map/$sessionId/chore-lists", choreLists.toMap())

    override fun sendGreenkeepingRotations(sessionId: UUID, rotations: Map<UUID, GreenkeepingRotation>) =
        broker.publish("/topic/map/$sessionId/greenkeeping-rotations", rotations.toMap())
}
