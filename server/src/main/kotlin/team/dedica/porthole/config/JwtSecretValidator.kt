package team.dedica.porthole.config

import io.micronaut.context.env.Environment
import io.micronaut.context.event.StartupEvent
import io.micronaut.runtime.event.annotation.EventListener
import jakarta.inject.Singleton
import org.slf4j.LoggerFactory

/**
 * Fails startup when the JWT signing secret is still set to the insecure default
 * and the active Micronaut environment is not "dev" or "test".
 */
@Singleton
class JwtSecretValidator(
    private val props: PortholeAuthProperties,
    private val env: Environment,
) {
    private val log = LoggerFactory.getLogger(JwtSecretValidator::class.java)

    @EventListener
    fun validate(event: StartupEvent) {
        if (!props.jwt.isUsingDefaultSecret()) return

        val activeProfiles = env.activeNames.toSet()
        val devProfiles = setOf("dev", "test", "local")
        if (activeProfiles.any { it in devProfiles }) {
            log.warn(
                "⚠️  PORTHOLE_JWT_SECRET is set to the insecure default. " +
                "This is acceptable for local development but MUST be changed before deploying to production."
            )
            return
        }

        throw IllegalStateException(
            "PORTHOLE_JWT_SECRET is still set to the insecure default value. " +
            "Set a strong, unique secret (≥ 32 bytes) via the PORTHOLE_JWT_SECRET environment variable before starting in production. " +
            "To suppress this check during local development, activate the 'dev' Micronaut environment."
        )
    }
}
