package team.dedica.porthole.application.session.chorelists

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import java.util.UUID

@Component
class RemoveChoreListUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserPort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: UUID, listId: UUID, username: String) {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        state.requireCollaborator(user.id)
        require(state.choreLists.containsKey(listId)) { "Chore list $listId not found" }
        state.choreLists.remove(listId)
        mapStatePort.save(state)
        broadcastPort.sendChoreLists(mapId, state.choreLists)
    }
}
