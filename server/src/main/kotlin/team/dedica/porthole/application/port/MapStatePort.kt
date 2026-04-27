package team.dedica.porthole.application.port

import team.dedica.porthole.domain.MapState

interface MapStatePort {
    fun findById(id: String): MapState?
    fun save(state: MapState)
    fun findAll(): List<MapState>
    fun delete(id: String)
}
