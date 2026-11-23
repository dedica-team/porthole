package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.session.processes.*
import team.dedica.porthole.domain.*
import java.util.UUID

class ProcessBroadcastTest {
    @Test
    fun `every process mutation broadcasts an invalidation`() {
        val caller = UUID.randomUUID()
        val state = SessionState(map = HexMap.createHexagonal(3))
        state.collaborators.add(Collaborator(id = caller, username = "Alice"))
        val port = InMemorySessionStatePort().also { it.save(state) }
        val auth = InMemoryAuthorizationPort(port)
        val broadcast: BroadcastPort = mock()
        val connection = Connection(originId = UUID.randomUUID(), targetId = UUID.randomUUID(), path = emptyList())
        state.connections[connection.id] = connection

        fun check(count: Int) = verify(broadcast, times(count)).sendProcesses(state.id)
        val process = CreateProcessUseCase(port, broadcast, auth).execute(state.id, "Flow", null, caller).single()
        check(1)
        EditProcessUseCase(port, broadcast, auth).execute(state.id, process.id, "Updated", null, caller)
        check(2)
        AddProcessStageUseCase(port, broadcast, auth).execute(state.id, process.id, "Stage", 0, caller)
        check(3)
        val stage = process.stages.single()
        EditProcessStageUseCase(port, broadcast, auth).execute(state.id, process.id, stage.id, "Edited", false, null, caller)
        check(4)
        ReorderProcessStagesUseCase(port, broadcast, auth).execute(state.id, process.id, listOf(stage.id), caller)
        check(5)
        AddStageConnectionUseCase(port, broadcast, auth).execute(state.id, process.id, stage.id, connection.id, null, "FORWARD", caller)
        check(6)
        val stageConnection = process.stages.single().connections.single()
        EditStageConnectionUseCase(port, broadcast, auth).execute(state.id, process.id, stage.id, stageConnection.id, "Title", false, null, caller)
        check(7)
        RemoveStageConnectionUseCase(port, broadcast, auth).execute(state.id, process.id, stage.id, stageConnection.id, caller)
        check(8)
        RemoveProcessStageUseCase(port, broadcast, auth).execute(state.id, process.id, stage.id, caller)
        check(9)
        RemoveProcessUseCase(port, broadcast, auth).execute(state.id, process.id, caller)
        check(10)
        assertEquals(emptyMap<UUID, Process>(), port.findById(state.id)!!.processes)
    }
}