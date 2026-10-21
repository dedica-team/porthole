package team.dedica.porthole.adapter.out.persistence

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import io.micronaut.context.BeanContext
import io.micronaut.context.event.StartupEvent
import org.mockito.kotlin.mock
import team.dedica.porthole.application.InMemoryAuthorizationPort
import team.dedica.porthole.application.InMemorySessionStatePort
import team.dedica.porthole.application.InMemoryTestUserRepository
import team.dedica.porthole.application.NoOpBroadcastPort
import team.dedica.porthole.application.lobby.JoinMapUseCase
import team.dedica.porthole.application.session.greenkeeping.AdvanceGreenkeepingRotationUseCase
import team.dedica.porthole.application.session.greenkeeping.CreateGreenkeepingRotationUseCase
import team.dedica.porthole.application.session.greenkeeping.StartGreenkeepingChecklistUseCase
import team.dedica.porthole.application.session.greenkeeping.UpdateGreenkeepingChecklistUseCase
import team.dedica.porthole.application.session.landscaping.CreateConnectionUseCase
import team.dedica.porthole.application.session.landscaping.EditLandmarkUseCase
import team.dedica.porthole.application.session.landscaping.PlaceLandmarkUseCase
import team.dedica.porthole.application.session.metrics.*
import team.dedica.porthole.application.session.processes.AddProcessStageUseCase
import team.dedica.porthole.application.session.processes.AddStageConnectionUseCase
import team.dedica.porthole.application.session.processes.CreateProcessUseCase
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.UpdateChoreEntryUseCase
import team.dedica.porthole.adapter.out.persistence.DemoDataLoader.Companion.DEMO_MAP_ID

/**
 * Integration test for [DemoDataLoader].
 *
 * Wires all use cases against in-memory ports (no Spring context, no file I/O)
 * and verifies that the loader runs to completion without throwing, and that the
 * resulting MapState contains the expected number of domain objects.
 */
class DemoDataLoaderTest {

    private val mapPort  = InMemorySessionStatePort()
    private val userPort = InMemoryTestUserRepository()
    private val broadcast = NoOpBroadcastPort()
    private val authPort = InMemoryAuthorizationPort(mapPort)

    private val loader = DemoDataLoader(
        sessionStatePort            = mapPort,
        userPort                = userPort,
        joinMapUseCase          = JoinMapUseCase(mapPort, userPort, broadcast),
        createGroupUseCase      = CreateGroupUseCase(mapPort, broadcast, authPort),
        createMetricUseCase     = CreateMetricUseCase(mapPort, broadcast, authPort),
        placeLandmarkUseCase    = PlaceLandmarkUseCase(mapPort, broadcast, authPort),
        editLandmarkUseCase     = EditLandmarkUseCase(mapPort, broadcast, authPort),
        setLandmarkMetricUseCase= SetLandmarkMetricUseCase(mapPort, broadcast, authPort),
        createConnectionUseCase = CreateConnectionUseCase(mapPort, broadcast, authPort),
        setMatrixEntryUseCase   = SetMatrixEntryUseCase(mapPort, broadcast, authPort),
        createProcessUseCase    = CreateProcessUseCase(mapPort, authPort),
        addProcessStageUseCase  = AddProcessStageUseCase(mapPort, authPort),
        addStageConnectionUseCase = AddStageConnectionUseCase(mapPort, authPort),
        createChoreListUseCase  = CreateChoreListUseCase(mapPort, broadcast, authPort),
        updateChoreEntryUseCase = UpdateChoreEntryUseCase(mapPort, broadcast, authPort),
        createGreenkeepingRotationUseCase = CreateGreenkeepingRotationUseCase(mapPort, broadcast, authPort),
        advanceGreenkeepingRotationUseCase = AdvanceGreenkeepingRotationUseCase(mapPort, broadcast, authPort),
        startGreenkeepingChecklistUseCase = StartGreenkeepingChecklistUseCase(mapPort, broadcast, authPort),
        updateGreenkeepingChecklistUseCase = UpdateGreenkeepingChecklistUseCase(mapPort, broadcast, authPort),
    )

    private val event = StartupEvent(mock<BeanContext>())

    @Test
    fun `loader runs to completion without throwing`() {
        assertDoesNotThrow { loader.run(event) }
    }

    @Test
    fun `map is persisted with correct id`() {
        loader.run(event)
        assertNotNull(mapPort.findById(DEMO_MAP_ID), "Demo map must be persisted")
    }

    @Test
    fun `all 5 users are created`() {
        loader.run(event)
        listOf(
            DemoDataLoader.UN_PETRA, DemoDataLoader.UN_SARAH,
            DemoDataLoader.UN_JAMES, DemoDataLoader.UN_ANNA, DemoDataLoader.UN_MARC,
        ).forEach { username ->
            assertNotNull(userPort.findByUsername(username), "User '$username' must exist")
        }
    }

    @Test
    fun `map has 5 collaborators`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(5, map.collaborators.size, "Expected 5 collaborators")
    }

    @Test
    fun `map has 3 groups`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(3, map.groups.size, "Expected 3 landmark groups")
    }

    @Test
    fun `map has 5 quality metrics`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(5, map.metrics.size, "Expected 5 quality metrics")
    }

    @Test
    fun `map has 15 landmarks`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(15, map.landmarks.size, "Expected 15 landmarks")
    }

    @Test
    fun `all landmarks are positioned on the map`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val unpositioned = map.landmarks.values.filter { it.coordinate == null }
        assertTrue(unpositioned.isEmpty(),
            "All landmarks must have a coordinate; unpositioned: ${unpositioned.map { it.name }}")
    }

    @Test
    fun `all landmarks belong to a group`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val ungrouped = map.landmarks.values.filter { it.groupId == null }
        assertTrue(ungrouped.isEmpty(),
            "All landmarks must have a groupId; ungrouped: ${ungrouped.map { it.name }}")
    }

    @Test
    fun `all landmarks have a description`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val noDesc = map.landmarks.values.filter { it.description.isNullOrBlank() }
        assertTrue(noDesc.isEmpty(),
            "All landmarks must have a description; missing: ${noDesc.map { it.name }}")
    }

    @Test
    fun `map has 10 connections`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(10, map.connections.size, "Expected 10 connections")
    }

    @Test
    fun `all connection paths are non-empty and start and end at landmark tiles`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
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
        loader.run(event)
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
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(2, map.processes.size, "Expected 2 processes")
    }

    @Test
    fun `each process has at least 2 stages`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        map.processes.values.forEach { process ->
            assertTrue(process.stages.size >= 2,
                "Process '${process.name}' must have at least 2 stages, has ${process.stages.size}")
        }
    }

    @Test
    fun `collaborator matrix has entries for all 15 landmarks`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val landmarkIds = map.landmarks.keys
        val matrixIds   = map.collaboratorMatrix.entries.keys
        val missing = landmarkIds - matrixIds
        assertTrue(missing.isEmpty(),
            "Matrix is missing entries for landmarks: ${missing.map { map.landmarks[it]?.name }}")
    }

    @Test
    fun `map has 3 chore lists`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(3, map.choreLists.size, "Expected 3 chore lists")
    }

    @Test
    fun `monthly audit chore list covers all 15 landmarks`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        val audit = map.choreLists.values.first { it.title == "Monthly Infection-Control Audit" }
        assertEquals(15, audit.entries.size, "Audit list must have an entry for each of the 15 landmarks")
    }

    @Test
    fun `chore list entries reference valid landmark ids`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        map.choreLists.values.forEach { list ->
            list.entries.keys.forEach { landmarkId ->
                assertNotNull(map.landmarks[landmarkId],
                    "Chore list '${list.title}' has entry for unknown landmark '$landmarkId'")
            }
        }
    }

    @Test
    fun `map has 3 greenkeeping rotations`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!
        assertEquals(3, map.greenkeepingRotations.size, "Expected 3 greenkeeping rotations")
    }

    @Test
    fun `greenkeeping rotations reference valid groups and collaborators`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!

        map.greenkeepingRotations.values.forEach { rotation ->
            assertTrue(rotation.groupIds.isNotEmpty(), "Rotation '${rotation.name}' must reference at least one group")
            rotation.groupIds.forEach { groupId ->
                assertNotNull(map.groups[groupId], "Rotation '${rotation.name}' references unknown group '$groupId'")
            }
            assertTrue(rotation.collaborators.isNotEmpty(), "Rotation '${rotation.name}' must reference at least one collaborator")
            rotation.collaborators.forEach { collaborator ->
                assertTrue(
                    map.collaborators.any { it.id == collaborator.collaboratorId },
                    "Rotation '${rotation.name}' references unknown collaborator '${collaborator.collaboratorId}'"
                )
            }
        }
    }

    @Test
    fun `greenkeeping rotations include progressed demo state`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!

        val clinicalRotation = map.greenkeepingRotations.values.first { it.name == "Clinical Hygiene Steward" }
        val diagnosticsRotation = map.greenkeepingRotations.values.first { it.name == "Diagnostics Equipment Steward" }
        val facilitiesRotation = map.greenkeepingRotations.values.first { it.name == "Front-of-House Readiness" }

        assertEquals(listOf(true, false, false), clinicalRotation.collaborators.map { it.done })
        assertEquals(listOf(true, true, false), diagnosticsRotation.collaborators.map { it.done })
        assertEquals(listOf(true, false, false), facilitiesRotation.collaborators.map { it.done })
    }

    @Test
    fun `greenkeeping rotations have task templates configured`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!

        val clinicalRotation = map.greenkeepingRotations.values.first { it.name == "Clinical Hygiene Steward" }
        val diagnosticsRotation = map.greenkeepingRotations.values.first { it.name == "Diagnostics Equipment Steward" }
        val facilitiesRotation = map.greenkeepingRotations.values.first { it.name == "Front-of-House Readiness" }

        assertEquals(4, clinicalRotation.taskTemplates.size, "Expected 4 task templates on clinical rotation")
        assertEquals(3, diagnosticsRotation.taskTemplates.size, "Expected 3 task templates on diagnostics rotation")
        assertEquals(3, facilitiesRotation.taskTemplates.size, "Expected 3 task templates on facilities rotation")
    }

    @Test
    fun `clinical hygiene steward rotation has active checklist with progress`() {
        loader.run(event)
        val map = mapPort.findById(DEMO_MAP_ID)!!

        val clinicalRotation = map.greenkeepingRotations.values.first { it.name == "Clinical Hygiene Steward" }
        val checklist = clinicalRotation.currentChecklist
        assertNotNull(checklist, "Clinical rotation must have an active checklist")
        assertEquals("Weekly Sterilisation Walk-Through", checklist?.title)
        assertEquals(4, checklist?.items?.size)
        assertEquals(2, checklist?.items?.count { it.done })
        assertEquals(listOf(true, true, false, false), checklist?.items?.map { it.done })
        assertNotNull(checklist?.items?.get(0)?.note)
        assertNotNull(checklist?.items?.get(1)?.note)
        assertNotNull(checklist?.items?.get(2)?.note)
        assertNull(checklist?.items?.get(3)?.note)
    }

    @Test
    fun `loader is idempotent – running twice does not throw and does not duplicate data`() {
        loader.run(event)
        val countAfterFirst = mapPort.findById(DEMO_MAP_ID)!!.landmarks.size

        assertDoesNotThrow { loader.run(event) }

        val countAfterSecond = mapPort.findById(DEMO_MAP_ID)!!.landmarks.size
        assertEquals(countAfterFirst, countAfterSecond,
            "Running the loader twice must not duplicate landmarks")
    }
}

