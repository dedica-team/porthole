package team.dedica.porthole.application.port

import team.dedica.porthole.domain.MapState
import java.util.UUID

interface MapStatePort {
    fun findById(id: UUID): MapState?
    fun save(state: MapState)
    fun findAll(): List<MapState>
    fun delete(id: UUID)
}
