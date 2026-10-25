package team.dedica.porthole.application.session.greenkeeping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class ListGreenkeepingRotationsUseCase(
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(sessionId: UUID, callerId: UUID): List<GreenkeepingRotation> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.VIEWER)
        return state.greenkeepingRotations.values.sortedBy { it.name.lowercase() }
    }
}

