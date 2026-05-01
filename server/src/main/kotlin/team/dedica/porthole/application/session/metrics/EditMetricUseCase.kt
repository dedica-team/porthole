package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.MapState

@Component
class EditMetricUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, username: String, metricId: String, name: String?, description: String?): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        val existing = state.metrics[metricId]
            ?: throw NoSuchElementException("Metric $metricId not found")
        if (name != null) require(name.isNotBlank()) { "Metric name must not be empty" }
        state.metrics[metricId] = existing.copy(
            name        = name?.trim() ?: existing.name,
            description = description?.trim() ?: existing.description,
        )
        mapStatePort.save(state)
        broadcastPort.sendMetrics(mapId, state.metrics)
        return state
    }
}