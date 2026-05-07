package team.dedica.porthole.application.session.greenkeeping

import org.springframework.stereotype.Component
import team.dedica.porthole.domain.SessionState
import java.time.Instant
import java.util.UUID

@Component
class RemoveCollaboratorFromGreenkeepingRotationsUseCase {
    fun execute(state: SessionState, collaboratorId: UUID): Boolean {
        var changed = false
        state.greenkeepingRotations.values.forEach { rotation ->
            val removed = rotation.collaborators.removeIf { it.collaboratorId == collaboratorId }
            if (removed) {
                changed = true
                rotation.updatedAt = Instant.now()
                rotation.updatedBy = null
            }
        }
        return changed
    }
}

