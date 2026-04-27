package team.dedica.porthole.application.lobby

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.MapState

@Component
class GetMapUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
) {
    fun execute(id: String, callerUsername: String? = null): MapState {
        val state = mapStatePort.findById(id)
            ?: throw NoSuchElementException("Map $id not found")

        // Private map visibility check
        if (state.collaborationMode == CollaborationMode.PRIVATE) {
            val callerId = callerUsername?.let { userPort.findByUsername(it)?.id }
            if (callerId == null || !state.isCollaborator(callerId)) {
                throw IllegalAccessException("Map is private")
            }
        }

        // Refresh each collaborator's avatarUrl from the current UserRecord so that
        // stale entries (persisted before avatarUrl was added) are always up-to-date.
        // Build a new list instead of replaceAll() to avoid ConcurrentModificationException
        // when the underlying list is shared / wrapped (e.g. Collections.unmodifiableList).
        val refreshed = state.collaborators.map { collaborator ->
            val freshAvatar = userPort.findByUsername(collaborator.username)?.avatarUrl
            if (freshAvatar != null && freshAvatar != collaborator.avatarUrl)
                collaborator.copy(avatarUrl = freshAvatar)
            else collaborator
        }
        val patched = refreshed != state.collaborators
        if (patched) {
            state.collaborators.clear()
            state.collaborators.addAll(refreshed)
            mapStatePort.save(state)
        }

        return state
    }
}