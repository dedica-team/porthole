package team.dedica.porthole.adapter.out.persistence

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.boot.DefaultApplicationArguments
import team.dedica.porthole.application.InMemoryMapStatePort
import team.dedica.porthole.application.InMemoryTestUserRepository
import team.dedica.porthole.application.NoOpBroadcastPort
import team.dedica.porthole.application.lobby.JoinMapUseCase
import team.dedica.porthole.application.session.landscaping.CreateConnectionUseCase
import team.dedica.porthole.application.session.landscaping.EditLandmarkUseCase
import team.dedica.porthole.application.session.landscaping.PlaceLandmarkUseCase
import team.dedica.porthole.application.session.metrics.*
import team.dedica.porthole.application.session.processes.AddProcessStageUseCase
import team.dedica.porthole.application.session.processes.AddStageConnectionUseCase
import team.dedica.porthole.application.session.processes.CreateProcessUseCase
import team.dedica.porthole.adapter.out.persistence.DemoDataLoader.Companion.DEMO_MAP_ID

/**
 * Integration test for [DemoDataLoader].
 *
 * Wires all use cases against in-memory ports (no Spring context, no file I/O)
 * and verifies that the loader runs to completion without throwing, and that the
 * resulting MapState contains the expected number of domain objects.
 */
class DemoDataLoaderTest {

    private val mapPort  = InMemoryMapStatePort()
    private val userPort = InMemoryTestUserRepository()
    private val broadcast = NoOpBroadcastPort()

    private val loader = DemoDataLoader(
        mapStatePort            = mapPort,
        userPort                = userPort,
        joinMapUseCase          = JoinMapUseCase(mapPort, userPort, broadcast),
        createGroupUseCase      = CreateGroupUseCase(mapPort, userPort, broadcast),
        createMetricUseCase     = CreateMetricUseCase(mapPort, userPort, broadcast),
        placeLandmarkUseCase    = PlaceLandmarkUseCase(mapPort, userPort, broadcast),
        editLandmarkUseCase     = EditLandmarkUseCase(mapPort, userPort, broadcast),
        setLandmarkMetricUseCase= SetLandmarkMetricUseCase(mapPort, userPort, broadcast),
        createConnectionUseCase = CreateConnectionUseCase(mapPort, userPort, broadcast),
        setMatrixEntryUseCase   = SetMatrixEntryUseCase(mapPort, userPort, broadcast),
        createProcessUseCase    = CreateProcessUseCase(mapPort, userPort),
        addProcessStageUseCase  = AddProcessStageUseCase(mapPort, userPort),
        addStageConnectionUseCase = AddStageConnectionUseCase(mapPort, userPort),
    )

    @Test
    fun `loader runs to completion without throwing`() {
        assertDoesNotThrow { loader.run(DefaultApplicationArguments()) }
    }

    @Test
    fun `map is persisted with correct id`() {
        loader.run(DefaultApplicationArguments())
        assertNotNull(mapPort.findById(DEMO_MAP_ID), "Demo map must be persisted")
    }

    @Test
    fun `all 5 users are created`() {
        loader.run(DefaultApplicationArguments())
        listOf(
            DemoDataLoader.UN_PETRA, DemoDataLoader.UN_SARAH,
            DemoDataLoader.UN_JAMES, DemoDataLoader.UN_ANNA, DemoDataLoader.UN_MARC,
        ).forEach { username ->
            assertNotNull(userPort.findByUsername(username), "User '$username' must exist")
        }
    }

    @Test
    fun `map has 5 collaborators`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(5, map.collaborators.size, "Expected 5 collaborators")
    }

    @Test
    fun `map has 3 groups`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(3, map.groups.size, "Expected 3 landmark groups")
    }

    @Test
    fun `map has 5 quality metrics`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(5, map.metrics.size, "Expected 5 quality metrics")
    }

    @Test
    fun `map has 15 landmarks`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(15, map.landmarks.size, "Expected 15 landmarks")
    }

    @Test
    fun `all landmarks are positioned on the map`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val unpositioned = map.landmarks.values.filter { it.coordinate == null }
        assertTrue(unpositioned.isEmpty(),
            "All landmarks must have a coordinate; unpositioned: ${unpositioned.map { it.name }}")
    }

    @Test
    fun `all landmarks belong to a group`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val ungrouped = map.landmarks.values.filter { it.groupId == null }
        assertTrue(ungrouped.isEmpty(),
            "All landmarks must have a groupId; ungrouped: ${ungrouped.map { it.name }}")
    }

    @Test
    fun `all landmarks have a description`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val noDesc = map.landmarks.values.filter { it.description.isNullOrBlank() }
        assertTrue(noDesc.isEmpty(),
            "All landmarks must have a description; missing: ${noDesc.map { it.name }}")
    }

    @Test
    fun `map has 10 connections`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(10, map.connections.size, "Expected 10 connections")
    }

    @Test
    fun `all connection paths are non-empty and start and end at landmark tiles`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val landmarkCoords = map.landmarks.values.mapNotNull { it.coordinate }.toSet()
        map.connections.values.forEach { conn ->
            assertTrue(conn.path.isNotEmpty(), "Connection '${conn.name}' has empty path")
            val origin = map.landmarks[conn.originId]?.coordinate
            val target = map.landmarks[conn.targetId]?.coordinate
            assertEquals(origin, conn.path.first(),
                "Connection '${conn.name}' must start at origin landmark tile")
            assertEquals(target, conn.path.last(),
                "Connection '${conn.name}' must end at target landmark tile")
        }
    }

    @Test
    fun `no connection path passes through an intermediate landmark tile`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val landmarkCoords = map.landmarks.values.mapNotNull { it.coordinate }.toSet()
        map.connections.values.forEach { conn ->
            val origin = map.landmarks[conn.originId]?.coordinate
            val target = map.landmarks[conn.targetId]?.coordinate
            val intermediates = conn.path.drop(1).dropLast(1)
            val blocked = intermediates.filter { it in landmarkCoords }
            assertTrue(blocked.isEmpty(),
                "Connection '${conn.name}' path passes through landmark tile(s): $blocked")
        }
    }

    @Test
    fun `map has 2 processes`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(2, map.processes.size, "Expected 2 processes")
    }

    @Test
    fun `each process has at least 2 stages`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        map.processes.values.forEach { process ->
            assertTrue(process.stages.size >= 2,
                "Process '${process.name}' must have at least 2 stages, has ${process.stages.size}")
        }
    }

    @Test
    fun `collaborator matrix has entries for all 15 landmarks`() {
        loader.run(DefaultApplicationArguments())
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val landmarkIds = map.landmarks.keys
        val matrixIds   = map.collaboratorMatrix.entries.keys
        val missing = landmarkIds - matrixIds
        assertTrue(missing.isEmpty(),
            "Matrix is missing entries for landmarks: ${missing.map { map.landmarks[it]?.name }}")
    }

    @Test
    fun `loader is idempotent – running twice does not throw and does not duplicate data`() {
        loader.run(DefaultApplicationArguments())
        val countAfterFirst = mapPort.findById(DEMO_MAP_ID)!!.landmarks.size

        assertDoesNotThrow { loader.run(DefaultApplicationArguments()) }

        val countAfterSecond = mapPort.findById(DEMO_MAP_ID)!!.landmarks.size
        assertEquals(countAfterFirst, countAfterSecond,
            "Running the loader twice must not duplicate landmarks")
    }
}

