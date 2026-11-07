package team.dedica.porthole.application.session.game

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.GameEngine
import java.time.Instant

/**
 * Advances every running tower-defense simulation by one tick and broadcasts changes.
 * Invoked by the scheduled [team.dedica.porthole.adapter.in.scheduling.GameScheduler].
 */
@Singleton
class GameTickUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
) {
    fun tick(now: Instant = Instant.now()) {
        sessionStatePort.findAll().forEach { state ->
            if (!state.gameEnabled) return@forEach
            val landmarkTypesBefore = state.landmarks.mapValues { it.value.type }
            if (GameEngine.tick(state, now)) {
                sessionStatePort.save(state)
                broadcastPort.sendGame(state.id, state.gameState)
                // Destroyed buildings turn into ruins and scorch surrounding terrain,
                // so subscribers need a fresh map snapshot in addition to game state.
                if (state.landmarks.any { (id, landmark) -> landmarkTypesBefore[id] != landmark.type }) {
                    broadcastPort.send(state.id, state)
                }
            }
        }
    }
}
