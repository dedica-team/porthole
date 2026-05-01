package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

@Component
class RemoveGroupUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(mapId: UUID, callerId: UUID, groupId: UUID): SessionState {
        val state = authorizationPort.accessSession(callerId, mapId, SessionRole.COLLABORATOR)
        require(state.groups.containsKey(groupId)) { "Group $groupId not found" }
        state.groups.remove(groupId)
        // Clear groupId on all landmarks that referenced this group
        state.landmarks.replaceAll { _, landmark ->
            if (landmark.groupId == groupId) landmark.copy(groupId = null, metrics = landmark.metrics) else landmark
        }
        sessionStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
