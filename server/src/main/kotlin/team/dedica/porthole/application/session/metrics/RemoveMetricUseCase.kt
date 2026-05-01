package team.dedica.porthole.application.session.metrics
import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.MapState
import java.util.UUID
@Component
class RemoveMetricUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: UUID, username: String, metricId: UUID): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        require(state.metrics.containsKey(metricId)) { "Metric $metricId not found" }
        state.metrics.remove(metricId)
        // Cascade: remove this metric's entry from every landmark
        state.landmarks.replaceAll { _, landmark ->
            if (landmark.metrics.containsKey(metricId))
                landmark.copy(metrics = landmark.metrics - metricId)
            else
                landmark
        }
        mapStatePort.save(state)
        broadcastPort.sendMetrics(mapId, state.metrics)
        return state
    }
}
