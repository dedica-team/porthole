package team.dedica.porthole.adapter.out.repository

import org.springframework.stereotype.Repository
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.domain.MapState
import java.util.concurrent.ConcurrentHashMap

@Repository
class MapStateRepository : MapStatePort {
    private val maps = ConcurrentHashMap<String, MapState>()

    override fun findById(id: String): MapState? = maps[id]

    override fun save(state: MapState) { maps[state.id] = state }

    override fun findAll(): List<MapState> = maps.values.toList()

    override fun delete(id: String) { maps.remove(id) }
}
