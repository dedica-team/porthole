package team.dedica.porthole.application.session.metrics

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.CollaboratorMatrixEntry
import team.dedica.porthole.domain.MapState
import team.dedica.porthole.domain.MatrixLevel
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Component
class SetMatrixEntryUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: UUID, username: String, landmarkId: UUID, collaboratorId: UUID, level: MatrixLevel): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        require(state.landmarks.containsKey(landmarkId)) { "Landmark $landmarkId not found" }
        require(state.collaborators.any { it.id == collaboratorId }) { "Collaborator $collaboratorId not found" }
        val byLandmark = state.collaboratorMatrix.entries.getOrPut(landmarkId) { ConcurrentHashMap() }
        byLandmark[collaboratorId] = CollaboratorMatrixEntry(level)
        mapStatePort.save(state)
        broadcastPort.sendMatrix(mapId, state.collaboratorMatrix)
        return state
    }
}