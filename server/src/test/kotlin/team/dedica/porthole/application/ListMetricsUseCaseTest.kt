package team.dedica.porthole.application

import java.util.UUID
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.ListMetricsUseCase
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.SessionState

class ListMetricsUseCaseTest {

    private val collaboratorId = UUID.nameUUIDFromBytes("p1".toByteArray())
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: ListMetricsUseCase
    private lateinit var state: SessionState

    @BeforeEach
    fun setup() {
        mapStatePort = InMemorySessionStatePort()
        state = SessionState(map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 }))
        state.collaborators.add(Collaborator(id = collaboratorId, username = "Alice"))
        mapStatePort.save(state)
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = ListMetricsUseCase( authorizationPort)
    }

    @Test
    fun `returns empty map when no metrics exist`() {
        val result = useCase.execute(state.id, collaboratorId)
        assertTrue(result.isEmpty())
    }

    @Test
    fun `returns all metrics`() {
        val createUseCase = CreateMetricUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
        createUseCase.execute(state.id, collaboratorId, "Uptime", "System uptime")
        createUseCase.execute(state.id, collaboratorId, "Latency", "Response time")

        val result = useCase.execute(state.id, collaboratorId)
        assertEquals(2, result.size)
    }

    @Test
    fun `unknown map throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(UUID.randomUUID(), collaboratorId)
        }
    }

    @Test
    fun `non-collaborator viewer can access metrics`() {
        // VIEWER role is sufficient for listing metrics
        assertDoesNotThrow { useCase.execute(state.id, UUID.randomUUID()) }
    }
}

