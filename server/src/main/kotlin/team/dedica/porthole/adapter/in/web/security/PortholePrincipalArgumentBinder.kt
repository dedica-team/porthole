package team.dedica.porthole.adapter.`in`.web.security

import io.micronaut.core.bind.ArgumentBinder.BindingResult
import io.micronaut.core.convert.ArgumentConversionContext
import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.bind.binders.TypedRequestArgumentBinder
import io.micronaut.security.authentication.Authentication
import io.micronaut.security.filters.SecurityFilter
import jakarta.inject.Singleton
import team.dedica.porthole.application.port.UserPort
import java.util.*

/**
 * Binds an authenticated controller parameter (declared as `user: PortholePrincipal` or
 * `user: PortholePrincipal?`) from the [Authentication] placed on the request by the
 * security filter.
 *
 * This is the Micronaut equivalent of Spring's `@AuthenticationPrincipal`: no annotation is
 * required on the parameter, the type alone selects this binder. Micronaut dispatches binders
 * by the exact argument type, so the built-in `PrincipalArgumentBinder` (typed to
 * `java.security.Principal`) cannot handle [PortholePrincipal].
 *
 * Anonymous requests yield an empty-but-satisfied result, so nullable parameters become `null`
 * while required parameters fail fast (the security filter rejects unauthenticated requests
 * to protected routes before the controller is reached).
 */
@Singleton
class PortholePrincipalArgumentBinder(
    private val userRepository: UserPort? = null,
) : TypedRequestArgumentBinder<PortholePrincipal> {

    private val argumentType: Argument<PortholePrincipal> = Argument.of(PortholePrincipal::class.java)

    override fun argumentType(): Argument<PortholePrincipal> = argumentType

    override fun bind(
        context: ArgumentConversionContext<PortholePrincipal>,
        source: HttpRequest<*>,
    ): BindingResult<PortholePrincipal> {
        val authentication = source
            .getAttribute(SecurityFilter.AUTHENTICATION, Authentication::class.java)
            .orElse(null)
            ?: return BindingResult.empty()

        val principal = authentication.toPortholePrincipal()
            ?: return BindingResult.empty()

        return BindingResult { Optional.of(principal) }
    }

    private fun Authentication.toPortholePrincipal(): PortholePrincipal? {
        val rawLocalUserId = attributes[PortholePrincipal.USER_ID_ATTRIBUTE]
        if (rawLocalUserId != null) {
            val userId = runCatching { UUID.fromString(rawLocalUserId.toString()) }.getOrNull()
                ?: return null
            val username = (attributes["preferred_username"] as? String)?.takeIf { it.isNotBlank() }
                ?: (attributes["name"] as? String)?.takeIf { it.isNotBlank() }
                ?: (attributes["user_name"] as? String)?.takeIf { it.isNotBlank() }
                ?: (attributes["username"] as? String)?.takeIf { it.isNotBlank() }
                ?: name
                ?: "unknown"
            return PortholePrincipal(userId = userId, username = username, attributes = attributes)
        }

        val subject = attributes["sub"]?.toString()
            ?: attributes["id"]?.toString()
            ?: name
            ?: return null

        val localUser = userRepository?.findByKeycloakId(subject)
        val userId = localUser?.id ?: runCatching { UUID.fromString(subject) }.getOrElse {
            UUID.nameUUIDFromBytes(subject.toByteArray())
        }

        val username = localUser?.username
            ?: (attributes["preferred_username"] as? String)?.takeIf { it.isNotBlank() }
            ?: (attributes["name"] as? String)?.takeIf { it.isNotBlank() }
            ?: (attributes["user_name"] as? String)?.takeIf { it.isNotBlank() }
            ?: (attributes["username"] as? String)?.takeIf { it.isNotBlank() }
            ?: name
            ?: "unknown"

        return PortholePrincipal(userId = userId, username = username, attributes = attributes)
    }
}
