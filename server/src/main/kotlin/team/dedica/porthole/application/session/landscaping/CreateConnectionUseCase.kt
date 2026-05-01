package team.dedica.porthole.application.session.landscaping

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.AStarPathfinder
import team.dedica.porthole.domain.Connection
import team.dedica.porthole.domain.ConnectionType
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class CreateConnectionUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        fromLandmarkId: UUID,
        toLandmarkId: UUID,
        type: ConnectionType = ConnectionType.PIPE,
        name: String? = null,
        description: String? = null,
        callerId: UUID,
    ): SessionState {

        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)

        require(fromLandmarkId != toLandmarkId) { "Cannot connect a landmark to itself" }

        val trimmedName = name?.trim()
        require(trimmedName == null || trimmedName.isNotBlank()) { "name must not be blank" }
        val trimmedDescription = description?.trim()
        require(trimmedDescription == null || trimmedDescription.isNotBlank()) { "description must not be blank" }

        val fromLandmark = state.landmarks[fromLandmarkId]
            ?: throw NoSuchElementException("Landmark $fromLandmarkId not found")
        val toLandmark = state.landmarks[toLandmarkId]
            ?: throw NoSuchElementException("Landmark $toLandmarkId not found")

        require(fromLandmark.coordinate != null) { "Landmark '$fromLandmarkId' has no map position yet" }
        require(toLandmark.coordinate != null) { "Landmark '$toLandmarkId' has no map position yet" }

        val blockedByLandmarks = state.landmarks.values
            .mapNotNull { it.coordinate }
            .filter { it != fromLandmark.coordinate && it != toLandmark.coordinate }
            .toSet()

        val path = AStarPathfinder.findPath(state.map, fromLandmark.coordinate, toLandmark.coordinate, blockedByLandmarks)
            ?: throw IllegalStateException("No path exists between the two landmarks (path may be blocked by other landmarks)")

        val connection = Connection(
            originId = fromLandmarkId,
            targetId = toLandmarkId,
            path = path,
            type = type,
            name = trimmedName,
            description = trimmedDescription,
        )
        state.connections[connection.id] = connection

        sessionStatePort.save(state)
        broadcastPort.send(sessionId, state)
        return state
    }
}