package team.dedica.porthole.application.session.processes

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.SessionRole
import java.util.UUID

@Singleton
class EditProcessStageUseCase(
    private val sessionStatePort: SessionStatePort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        processId: UUID,
        stageId: UUID,
        name: String?,
        clearName: Boolean,
        order: Int?,
        callerId: UUID,
    ): List<Process> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val process = state.processes[processId] ?: throw NoSuchElementException("Process $processId not found")
        val idx = process.stages.indexOfFirst { it.id == stageId }
        if (idx < 0) throw NoSuchElementException("Stage $stageId not found in process $processId")
        val stage = process.stages[idx]
        val newName = when {
            clearName -> null
            name != null -> name.trim().takeIf { it.isNotBlank() } ?: stage.name
            else -> stage.name
        }
        process.stages[idx] = stage.copy(name = newName, order = order ?: stage.order)
        process.stages.sortBy { it.order }
        sessionStatePort.save(state)
        return state.processes.values.sortedBy { it.name }
    }
}
