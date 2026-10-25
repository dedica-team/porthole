package team.dedica.porthole.application.session.metrics

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Singleton
class EditCollaboratorMatrixUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        callerId: UUID,
        name: String? = null,
        collaborators: List<UUID>? = null,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        var updatedName = state.collaboratorMatrix.name
        if (name != null) {
            require(name.isNotBlank()) { "Matrix name must not be blank" }
            updatedName = name.trim()
        }
        val currentMatrix = state.collaboratorMatrix
        val updatedCollaborators = if (collaborators != null) {
            val sessionCollabIds = state.collaborators.map { it.id }.toSet()
            require(collaborators.all { sessionCollabIds.contains(it) }) { "All collaborators must belong to the session" }
            collaborators.distinct().toMutableList()
        } else {
            currentMatrix.collaborators
        }

        state.collaboratorMatrix = currentMatrix.copy(
            name = updatedName,
            collaborators = updatedCollaborators,
        )
        sessionStatePort.save(state)
        broadcastPort.sendMatrix(sessionId, state.collaboratorMatrix)
        return state
    }
}