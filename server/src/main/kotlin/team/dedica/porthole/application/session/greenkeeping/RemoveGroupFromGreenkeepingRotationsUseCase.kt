package team.dedica.porthole.application.session.greenkeeping

import jakarta.inject.Singleton
import team.dedica.porthole.domain.SessionState
import java.time.Instant
import java.util.UUID

@Singleton
class RemoveGroupFromGreenkeepingRotationsUseCase {
    fun execute(state: SessionState, groupId: UUID): Boolean {
        var changed = false
        state.greenkeepingRotations.values.forEach { rotation ->
            val removed = rotation.groupIds.removeIf { it == groupId }
            if (removed) {
                changed = true
                rotation.updatedAt = Instant.now()
                rotation.updatedBy = null
            }
        }
        return changed
    }
}

