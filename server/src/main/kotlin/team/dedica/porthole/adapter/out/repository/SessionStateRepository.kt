package team.dedica.porthole.adapter.out.repository

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.SessionState
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Singleton
class SessionStateRepository : SessionStatePort {
    private val maps = ConcurrentHashMap<UUID, SessionState>()

    override fun findById(id: UUID): SessionState? = maps[id]

    override fun save(state: SessionState) {
        maps[state.id] = state
    }

    override fun findAll(): List<SessionState> = maps.values.toList()

    override fun delete(id: UUID) {
        maps.remove(id)
    }
}
