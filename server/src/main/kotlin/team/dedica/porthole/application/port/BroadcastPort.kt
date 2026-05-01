package team.dedica.porthole.application.port

import team.dedica.porthole.domain.ChoreList
import team.dedica.porthole.domain.CollaboratorMatrix
import team.dedica.porthole.domain.MapState
import team.dedica.porthole.domain.QualityMetric

/**
 * Web socket broadcasts.
 */
interface BroadcastPort {
    fun send(mapId: String, state: MapState)
    fun sendMatrix(mapId: String, matrix: CollaboratorMatrix)
    fun sendMetrics(mapId: String, metrics: Map<String, QualityMetric>)
    fun sendChoreLists(mapId: String, choreLists: Map<String, ChoreList>)
}

