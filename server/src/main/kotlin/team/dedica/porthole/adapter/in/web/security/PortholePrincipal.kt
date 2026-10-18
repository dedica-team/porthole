package team.dedica.porthole.adapter.`in`.web.security

import java.security.Principal
import java.util.UUID

/**
 * Authenticated caller, resolved from a Porthole JWT.
 * Replaces the former Spring `UserDetails` implementation.
 */
data class PortholePrincipal(
    val userId: UUID,
    val username: String,
) : Principal {
    override fun getName(): String = username

    val roles: List<String> get() = listOf("USER")

    companion object {
        const val USER_ID_ATTRIBUTE = "userId"
    }
}
