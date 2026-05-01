package team.dedica.porthole.application.session

import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.MapState
import java.util.UUID

class AuthUtil(private val userPort: UserPort, private val mapStatePort: MapStatePort) {

    fun ensureUserHasReadAccessInMap(userId: UUID, mapId: UUID){
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        userPort.findById(userId)
            ?: throw NoSuchElementException("User $userId not found")
        state.requireReadAccess(userId)

    }

    companion object {

        fun with(userPort: UserPort, mapPort: MapStatePort): AuthUtil =
            AuthUtil(userPort, mapPort)
    }
}