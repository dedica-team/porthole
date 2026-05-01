package team.dedica.porthole.application.port

import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.SessionState
import team.dedica.porthole.domain.QualityMetric
import java.util.UUID

/**
 * Web socket broadcasts.
 */
interface BroadcastPort {
    fun send(mapId: UUID, state: SessionState)
    fun sendMatrix(mapId: UUID, matrix: CollaboratorMatrix)
    fun sendMetrics(mapId: UUID, metrics: Map<UUID, QualityMetric>)
    fun sendChoreLists(mapId: UUID, choreLists: Map<UUID, ChoreList>)
}

