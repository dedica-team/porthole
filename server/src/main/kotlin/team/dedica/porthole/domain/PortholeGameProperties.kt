package team.dedica.porthole.domain

import io.micronaut.context.annotation.ConfigurationProperties
import io.micronaut.core.annotation.Introspected

/**
 * Configuration properties for the tower-defense game mechanics.
 */
@ConfigurationProperties("porthole.game")
@Introspected
class PortholeGameProperties {
    /**
     * The intermission period between waves (e.g. "PT1H", "PT20S", "1h").
     * Defaults to one hour ("PT1H").
     */
    var waveIntermissionPeriod: String = GameEngine.WAVE_INTERMISSION_PERIOD
}
