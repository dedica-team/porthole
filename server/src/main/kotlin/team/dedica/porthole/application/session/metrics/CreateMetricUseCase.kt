package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.MapState
import team.dedica.porthole.domain.QualityMetric
import java.util.UUID

@Component
class CreateMetricUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, username: String, name: String, description: String): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        require(name.isNotBlank()) { "Metric name must not be empty" }
        val id = UUID.randomUUID().toString()
        state.metrics[id] = QualityMetric(id = id, name = name.trim(), description = description.trim())
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
