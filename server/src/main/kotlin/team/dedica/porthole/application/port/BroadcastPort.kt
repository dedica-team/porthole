package team.dedica.porthole.application.port

import team.dedica.porthole.domain.MapState

interface BroadcastPort {
    fun send(mapId: String, state: MapState)
}

