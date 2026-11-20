package team.dedica.porthole.application.session.metrics

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.adapter.`in`.web.security.ScopedJwtService
import team.dedica.porthole.adapter.out.authorization.AuthorizationService
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.config.PortholeAuthProperties
import team.dedica.porthole.domain.*
import java.util.UUID

class GeneratePushTokenUseCaseTest {

    private lateinit var sessionStatePort: SessionStatePort
    private lateinit var authorizationService: AuthorizationService
    private lateinit var scopedJwtService: ScopedJwtService
    private lateinit var useCase: GeneratePushTokenUseCase

    private val sessionId = UUID.randomUUID()
    private val collaboratorId = UUID.randomUUID()
    private val strangerId = UUID.randomUUID()
    private val metricId = UUID.randomUUID()

    @BeforeEach
    fun setup() {
        val state = SessionState(id = sessionId, map = HexMap.createHexagonal(radius = 1, elevationFn = { 1 })).apply {
            collaborators.add(Collaborator(id = collaboratorId, username = "collaborator"))
            metrics[metricId] = QualityMetric(id = metricId, name = "Code Coverage", description = "Coverage")
        }

        val inMemoryStates = mutableMapOf(sessionId to state)
        sessionStatePort = object : SessionStatePort {
            override fun findById(id: UUID): SessionState? = inMemoryStates[id]
            override fun save(state: SessionState) { inMemoryStates[state.id] = state }
            override fun delete(id: UUID) { inMemoryStates.remove(id) }
            override fun findAll(): List<SessionState> = inMemoryStates.values.toList()
        }

        val adminService = AdminService("")
        authorizationService = AuthorizationService(adminService, sessionStatePort)

        val props = PortholeAuthProperties().apply {
            jwt.secret = "test-secret-key-for-unit-tests-only-do-not-use-in-production-256bit!!"
        }
        scopedJwtService = ScopedJwtService(props)

        useCase = GeneratePushTokenUseCase(authorizationService, scopedJwtService)
    }

    @Test
    fun `generates push token for existing metric by id`() {
        val token = useCase.execute(sessionId, collaboratorId, metricId)
        assertNotNull(token)
        assertTrue(token.isNotBlank())
    }

    @Test
    fun `fails when metric does not exist`() {
        val nonExistentMetricId = UUID.randomUUID()
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(sessionId, collaboratorId, nonExistentMetricId)
        }
    }

    @Test
    fun `fails when caller is not collaborator`() {
        assertThrows(AccessDeniedException::class.java) {
            useCase.execute(sessionId, strangerId, metricId)
        }
    }
}
