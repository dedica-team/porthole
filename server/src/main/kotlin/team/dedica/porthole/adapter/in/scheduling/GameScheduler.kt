package team.dedica.porthole.adapter.`in`.scheduling

import io.micronaut.scheduling.annotation.Scheduled
import jakarta.inject.Singleton
import team.dedica.porthole.application.session.game.GameTickUseCase

/** Drives the tower-defense simulation once per second. */
@Singleton
class GameScheduler(private val gameTickUseCase: GameTickUseCase) {

    @Scheduled(fixedDelay = "\${porthole.game.tick-interval-ms:1000}ms")
    fun tick() = gameTickUseCase.tick()
}
