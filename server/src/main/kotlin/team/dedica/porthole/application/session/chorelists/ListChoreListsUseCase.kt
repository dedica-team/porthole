package team.dedica.porthole.application.session.chorelists

import org.springframework.stereotype.Component
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserWritePort
import team.dedica.porthole.domain.ChoreList

@Component
class ListChoreListsUseCase(
    private val mapStatePort: MapStatePort,
    private val userPort: UserWritePort,
) {
    fun execute(mapId: String, username: String): List<ChoreList> {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        // Viewers are allowed (no requireCollaborator check)
        userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        return state.choreLists.values.sortedBy { it.title }
    }
}

