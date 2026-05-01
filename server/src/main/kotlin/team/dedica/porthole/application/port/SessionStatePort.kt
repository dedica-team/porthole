package team.dedica.porthole.application.port

import team.dedica.porthole.domain.SessionState
import java.util.UUID

interface SessionStatePort {
    fun findById(id: UUID): SessionState?
    fun save(state: SessionState)
    fun findAll(): List<SessionState>
    fun delete(id: UUID)
}
