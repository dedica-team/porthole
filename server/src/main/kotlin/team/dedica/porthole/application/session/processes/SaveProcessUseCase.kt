package team.dedica.porthole.application.session.processes

import jakarta.inject.Singleton
import team.dedica.porthole.adapter.`in`.web.dto.SaveProcessStageRequest
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.Process
import team.dedica.porthole.domain.ProcessStage
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.StageConnection
import team.dedica.porthole.domain.StageConnectionDirection
import java.util.UUID

@Singleton
class SaveProcessUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        processId: UUID,
        name: String,
        description: String?,
        stages: List<SaveProcessStageRequest>,
        callerId: UUID
    ): List<Process> {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val process = state.processes[processId] ?: throw NoSuchElementException("Process $processId not found")
        val trimmedName = name.trim()
        if (trimmedName.isNotBlank()) {
            process.name = trimmedName
        }
        process.description = description?.trim()?.takeIf { it.isNotBlank() }

        process.stages.clear()
        stages.forEachIndexed { index, stageReq ->
            val stage = ProcessStage(
                id = stageReq.id ?: UUID.randomUUID(),
                name = stageReq.name?.trim()?.takeIf { it.isNotBlank() },
                order = if (stageReq.order >= 0) stageReq.order else index,
            )
            stageReq.connections.forEach { connReq ->
                try {
                    val connUuid = UUID.fromString(connReq.connectionId)
                    if (state.connections.containsKey(connUuid)) {
                        val dir = try {
                            StageConnectionDirection.valueOf(connReq.direction.uppercase())
                        } catch (_: IllegalArgumentException) {
                            StageConnectionDirection.FORWARD
                        }
                        stage.connections.add(
                            StageConnection(
                                id = connReq.id ?: UUID.randomUUID(),
                                connectionId = connUuid,
                                title = connReq.title?.trim()?.takeIf { it.isNotBlank() },
                                direction = dir,
                            )
                        )
                    }
                } catch (_: IllegalArgumentException) {
                    // Skip invalid connection UUID
                }
            }
            process.stages.add(stage)
        }

        sessionStatePort.save(state)
        broadcastPort.sendProcesses(sessionId)
        return state.processes.values.sortedBy { it.name }
    }
}
