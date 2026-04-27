package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.MapState

@Component
class ClearLandmarkMetricUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, landmarkId: String, metricId: String, username: String? = null): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        if (username != null) {
            val user = userPort.findByUsername(username)
                ?: throw NoSuchElementException("User $username not found")
            state.requireCollaborator(user.id)
        }
        val landmark = state.landmarks[landmarkId]
            ?: throw NoSuchElementException("Landmark $landmarkId not found")
        // Idempotent – no error if the entry doesn't exist
        if (landmark.metrics.containsKey(metricId)) {
            state.landmarks[landmarkId] = landmark.copy(metrics = landmark.metrics - metricId)
            mapStatePort.save(state)
            broadcastPort.send(mapId, state)
        }
        return state
    }
}