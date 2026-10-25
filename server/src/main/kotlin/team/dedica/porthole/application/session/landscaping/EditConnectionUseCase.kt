package team.dedica.porthole.application.session.landscaping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.ConnectionType
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
class EditConnectionUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        connectionId: UUID,
        type: ConnectionType? = null,
        name: String? = null,
        description: String? = null,
        clearName: Boolean = false,
        clearDescription: Boolean = false,
        callerId: UUID,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val existing = state.connections[connectionId]
            ?: throw NoSuchElementException("Connection $connectionId not found")

        val trimmedName = name?.trim()
        require(trimmedName == null || trimmedName.isNotBlank()) { "name must not be blank" }
        val trimmedDescription = description?.trim()
        require(trimmedDescription == null || trimmedDescription.isNotBlank()) { "description must not be blank" }

        val updated = existing.copy(
            type = type ?: existing.type,
            name = when {
                clearName -> null
                trimmedName != null -> trimmedName
                else -> existing.name
            },
            description = when {
                clearDescription -> null
                trimmedDescription != null -> trimmedDescription
                else -> existing.description
            },
        )
        state.connections[connectionId] = updated
        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}
