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
    fun send(sessionId: UUID, state: SessionState)
    fun sendMatrix(sessionId: UUID, matrix: CollaboratorMatrix)
    fun sendMetrics(sessionId: UUID, metrics: Map<UUID, QualityMetric>)
    fun sendChoreLists(sessionId: UUID, choreLists: Map<UUID, ChoreList>)
}

