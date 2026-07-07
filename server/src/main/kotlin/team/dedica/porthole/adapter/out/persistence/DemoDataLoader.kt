package team.dedica.porthole.adapter.out.persistence

import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.lobby.JoinMapUseCase
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.application.port.UserPort
import team.dedica.porthole.application.session.greenkeeping.AdvanceGreenkeepingRotationUseCase
import team.dedica.porthole.application.session.greenkeeping.CreateGreenkeepingRotationUseCase
import team.dedica.porthole.application.session.greenkeeping.GreenkeepingRotationCollaboratorPatch
import team.dedica.porthole.application.session.landscaping.CreateConnectionUseCase
import team.dedica.porthole.application.session.landscaping.EditLandmarkUseCase
import team.dedica.porthole.application.session.landscaping.PlaceLandmarkUseCase
import team.dedica.porthole.application.session.metrics.CreateGroupUseCase
import team.dedica.porthole.application.session.metrics.CreateMetricUseCase
import team.dedica.porthole.application.session.metrics.SetLandmarkMetricUseCase
import team.dedica.porthole.application.session.metrics.SetMatrixEntryUseCase
import team.dedica.porthole.application.session.chorelists.CreateChoreListUseCase
import team.dedica.porthole.application.session.chorelists.UpdateChoreEntryUseCase
import team.dedica.porthole.application.session.processes.AddProcessStageUseCase
import team.dedica.porthole.application.session.processes.AddStageConnectionUseCase
import team.dedica.porthole.application.session.processes.CreateProcessUseCase
import team.dedica.porthole.domain.*
import java.time.Instant
import java.util.UUID
import kotlin.math.abs

/**
 * Loads demo data for a Pet Clinic landscape when `porthole.demo.enabled=true`
 * (environment variable: `PORTHOLE_DEMO_ENABLED=true`).
 *
 * ## Why no hexLine?
 * The previous implementation computed connection paths manually via a `hexLine` function
 * (straight-line lerp on hex cube coordinates). That was only needed because connections
 * were assembled by hand, bypassing [CreateConnectionUseCase].
 * [CreateConnectionUseCase] already calls [AStarPathfinder] internally, which:
 *   - always returns valid tile-centre paths (A* only visits tiles that exist on the map),
 *   - automatically avoids tiles occupied by other landmarks, and
 *   - is the same code path used at runtime.
 * Therefore `hexLine` is unnecessary and has been removed entirely.
 *
 * ## Architecture
 * All domain mutations go through the application use cases (same as the REST API).
 * The only direct infrastructure access is:
 *   - creating the initial [SessionState] with the fixed demo ID and hexagonal map (no use
 *     case covers custom IDs or the hexagonal map type), and
 *   - saving [UserRecord]s (users come from auth providers; there is no "create user" use case).
 */
@Component
@ConditionalOnProperty(name = ["porthole.demo.enabled"], havingValue = "true")
class DemoDataLoader(
    // Infrastructure ports (direct access only where no use case exists)
    private val sessionStatePort: SessionStatePort,
    private val userPort: UserPort,
    // Use cases
    private val joinMapUseCase: JoinMapUseCase,
    private val createGroupUseCase: CreateGroupUseCase,
    private val createMetricUseCase: CreateMetricUseCase,
    private val placeLandmarkUseCase: PlaceLandmarkUseCase,
    private val editLandmarkUseCase: EditLandmarkUseCase,
    private val setLandmarkMetricUseCase: SetLandmarkMetricUseCase,
    private val createConnectionUseCase: CreateConnectionUseCase,
    private val setMatrixEntryUseCase: SetMatrixEntryUseCase,
    private val createProcessUseCase: CreateProcessUseCase,
    private val addProcessStageUseCase: AddProcessStageUseCase,
    private val addStageConnectionUseCase: AddStageConnectionUseCase,
    private val createChoreListUseCase: CreateChoreListUseCase,
    private val updateChoreEntryUseCase: UpdateChoreEntryUseCase,
    private val createGreenkeepingRotationUseCase: CreateGreenkeepingRotationUseCase,
    private val advanceGreenkeepingRotationUseCase: AdvanceGreenkeepingRotationUseCase,
) : ApplicationRunner {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        val DEMO_MAP_ID = UUID.nameUUIDFromBytes("demo-pet-clinic".toByteArray())

        // Fixed user IDs so that matrix entries reference stable collaborator IDs across restarts.
        val USER_DR_SARAH: UUID = UUID.fromString("00000001-0000-0000-0000-000000000001")
        val USER_DR_JAMES: UUID = UUID.fromString("00000001-0000-0000-0000-000000000002")
        val USER_NURSE_ANNA: UUID = UUID.fromString("00000001-0000-0000-0000-000000000003")
        val USER_ADMIN_PETRA: UUID = UUID.fromString("00000001-0000-0000-0000-000000000004")
        val USER_TECH_MARC: UUID = UUID.fromString("00000001-0000-0000-0000-000000000005")

        // Usernames used for UserRecord creation
        const val UN_SARAH = "dr-sarah"
        const val UN_JAMES = "dr-james"
        const val UN_ANNA = "nurse-anna"
        const val UN_PETRA = "admin-petra"
        const val UN_MARC = "tech-marc"
    }

    // Group/metric IDs are UUIDs generated by the use cases; captured after each call.
    private lateinit var groupClinical: UUID
    private lateinit var groupSupport: UUID
    private lateinit var groupFacilities: UUID
    private lateinit var metricSatisfaction: UUID
    private lateinit var metricInfection: UUID
    private lateinit var metricEquipUptime: UUID
    private lateinit var metricWaitTime: UUID
    private lateinit var metricStaffResp: UUID

    // Connection IDs captured after CreateConnectionUseCase calls (needed for processes).
    private lateinit var connEntranceReception: UUID
    private lateinit var connReceptionWaiting: UUID
    private lateinit var connWaitingExam1: UUID
    private lateinit var connWaitingExam2: UUID
    private lateinit var connExam1Lab: UUID
    private lateinit var connExam2Xray: UUID
    private lateinit var connLabPharmacy: UUID
    private lateinit var connPharmacyStorage: UUID

    // Landmark name → UUID (captured from PlaceLandmarkUseCase results)
    private val landmarkUuids: MutableMap<String, UUID> = mutableMapOf()

    // ── Entry point ───────────────────────────────────────────────────────────

    override fun run(args: ApplicationArguments) {

        log.info("Reloading pet clinic demo landscape …")
        createUsers()
        createInitialMap()
        addCollaborators()
        createGroups()
        createMetrics()
        placeLandmarks()
        createConnections()
        createProcesses()
        populateMatrix()
        createChoreLists()
        createGreenkeepingRotations()
        log.info("Pet clinic demo landscape loaded successfully")
    }

    // ── Users ─────────────────────────────────────────────────────────────────
    // Users originate from auth providers; there is no "create user" use case.

    private fun createUsers() {
        listOf(
            UserRecord(id = USER_DR_SARAH,   username = UN_SARAH, email = "sarah.mueller@petclinic.demo",  avatarUrl = "https://i.pravatar.cc/80?u=sarah-mueller"),
            UserRecord(id = USER_DR_JAMES,   username = UN_JAMES, email = "james.chen@petclinic.demo",     avatarUrl = "https://i.pravatar.cc/80?u=james-chen"),
            UserRecord(id = USER_NURSE_ANNA, username = UN_ANNA,  email = "anna.koch@petclinic.demo",      avatarUrl = "https://i.pravatar.cc/80?u=anna-koch"),
            UserRecord(id = USER_ADMIN_PETRA,username = UN_PETRA, email = "petra.bauer@petclinic.demo",    avatarUrl = "https://i.pravatar.cc/80?u=petra-bauer"),
            UserRecord(id = USER_TECH_MARC,  username = UN_MARC,  email = "marc.richter@petclinic.demo",   avatarUrl = "https://i.pravatar.cc/80?u=marc-richter"),
        ).forEach { record ->
            val existing = userPort.findById(record.id)
            if (existing == null || existing.avatarUrl != record.avatarUrl) userPort.save(record)
        }
        log.info("Demo users ready")
    }

    // ── Initial map ───────────────────────────────────────────────────────────
    // Direct MapState construction is required because:
    //   1. CreateMapUseCase only supports grid maps, not hexagonal.
    //   2. We need a deterministic fixed ID so the idempotency guard works on restart.

    private fun createInitialMap() {
        val hexMap = HexMap.createHexagonal(
            radius = 8,
            terrainFn = { coord ->
                val dist = abs(coord.q) + abs(coord.r) + abs(coord.s)
                if (dist > 14) Terrain.FOREST else Terrain.GRASS
            },
            elevationFn = { 1 },
        )
        val sessionState = SessionState(
            id = DEMO_MAP_ID,
            map = hexMap,
            name = "Happy Paws Pet Clinic",
            description = "Demo landscape for the Happy Paws Pet Clinic. Shows the clinic layout with 15 landmarks, quality metrics and workflow processes.",
            collaborationMode = CollaborationMode.OPEN,
            createdAt = Instant.parse("2026-01-15T09:00:00Z"),
        )
        // Add admin as first collaborator directly (others join via JoinMapUseCase).
        sessionState.collaborators.add(Collaborator(id = USER_ADMIN_PETRA, username = UN_PETRA, avatarUrl = "https://i.pravatar.cc/80?u=petra-bauer"))
        sessionStatePort.save(sessionState)
    }

    // ── Collaborators ─────────────────────────────────────────────────────────

    private fun addCollaborators() =
        listOf(USER_DR_SARAH, USER_DR_JAMES, USER_NURSE_ANNA, USER_TECH_MARC).forEach { joinMapUseCase.execute(DEMO_MAP_ID, it) }

    // ── Groups ────────────────────────────────────────────────────────────────

    private fun createGroups() {
        groupClinical = createGroup(USER_ADMIN_PETRA, "Clinical", "#3b82f6", "Patient examination, surgery and intensive care")
        groupSupport =
            createGroup(USER_ADMIN_PETRA, "Support Services", "#813d9c", "Diagnostics, pharmacy and medical supplies")
        groupFacilities = createGroup(USER_ADMIN_PETRA, "Facilities", "#2ec27e", "Reception, waiting area, kennel and admin")
    }

    private fun createGroup(owner: UUID, name: String, color: String, desc: String): UUID =
        createGroupUseCase.execute(DEMO_MAP_ID, owner, name, color, desc)
            .groups.values.first { it.name == name }.id

    // ── Quality Metrics ───────────────────────────────────────────────────────

    private fun createMetrics() {
        metricSatisfaction = createMetric(
            USER_ADMIN_PETRA, "Patient Satisfaction",
            "Average satisfaction score (1–5) collected from client feedback forms after each visit."
        )
        metricInfection = createMetric(
            USER_ADMIN_PETRA, "Infection Control",
            "Compliance rate with sterilisation and disinfection protocols as measured by monthly audits."
        )
        metricEquipUptime = createMetric(
            USER_ADMIN_PETRA, "Equipment Uptime",
            "Percentage of scheduled operating hours during which critical equipment is fully functional."
        )
        metricWaitTime = createMetric(
            USER_ADMIN_PETRA, "Average Wait Time",
            "Average number of minutes a patient waits in the waiting room before being called."
        )
        metricStaffResp = createMetric(
            USER_ADMIN_PETRA, "Staff Response Time",
            "Average time in minutes for staff to respond to a call or alert from a patient room."
        )
    }

    private fun createMetric(owner: UUID, name: String, desc: String): UUID =
        createMetricUseCase.execute(DEMO_MAP_ID, owner, name, desc, null)
            .metrics.values.first { it.name == name }.id

    // ── Landmarks ─────────────────────────────────────────────────────────────
    // PlaceLandmarkUseCase  → places (id from slug, type, coordinate, owner)
    // EditLandmarkUseCase   → adds description and group
    // SetLandmarkMetricUseCase → sets metric values

    private fun placeLandmarks() {
        val OK = QualityLevel.OK
        val W = QualityLevel.WARNING
        val E = QualityLevel.ERROR;
        val N = QualityLevel.NONE

        place(
            USER_ADMIN_PETRA, coord(0, -8), "Parking Area", LandmarkType.LIGHTHOUSE, groupFacilities,
            "Free parking for 30 vehicles, including 4 accessible spaces.",
            listOf(m(metricSatisfaction, "4.1 / 5", OK), m(metricStaffResp, "n/a", N))
        )

        place(
            USER_ADMIN_PETRA, coord(0, -6), "Main Entrance", LandmarkType.PORTAL, groupFacilities,
            "Automatic sliding doors with a welcome desk and hand-sanitiser station.",
            listOf(
                m(metricSatisfaction, "4.6 / 5", OK),
                m(metricInfection, "98 %", OK),
                m(metricWaitTime, "< 1 min", OK)
            )
        )

        place(
            USER_ADMIN_PETRA, coord(0, -4), "Reception", LandmarkType.HOUSE, groupFacilities,
            "Check-in and check-out, appointment scheduling and client records.",
            listOf(
                m(metricSatisfaction, "4.5 / 5", OK), m(metricWaitTime, "8 min", OK),
                m(metricStaffResp, "3 min", OK), m(metricInfection, "95 %", OK)
            )
        )

        place(
            USER_ADMIN_PETRA, coord(0, -2), "Waiting Room", LandmarkType.KEEP, groupFacilities,
            "Comfortable seating for 20 clients, separate dog/cat zones, children's corner.",
            listOf(
                m(metricWaitTime, "22 min", E), m(metricSatisfaction, "3.8 / 5", W),
                m(metricInfection, "96 %", OK), m(metricStaffResp, "5 min", W)
            )
        )

        place(
            USER_DR_SARAH, coord(-3, 0), "Examination Room 1", LandmarkType.KEEP, groupClinical,
            "General examination room for small animals. Dr. Sarah Müller's primary room.",
            listOf(
                m(metricInfection, "100 %", OK), m(metricEquipUptime, "98 %", OK),
                m(metricSatisfaction, "4.7 / 5", OK), m(metricStaffResp, "2 min", OK), m(metricWaitTime, "6 min", OK)
            )
        )

        place(
            USER_DR_JAMES, coord(3, 0), "Examination Room 2", LandmarkType.KEEP, groupClinical,
            "General examination room for dogs and medium-sized animals. Dr. James Chen's primary room.",
            listOf(
                m(metricInfection, "97 %", OK), m(metricEquipUptime, "72 %", E),
                m(metricSatisfaction, "4.3 / 5", OK), m(metricStaffResp, "3 min", OK), m(metricWaitTime, "9 min", OK)
            )
        )

        place(
            USER_DR_SARAH, coord(0, 2), "Surgery Suite", LandmarkType.ATOMIC_REACTOR, groupClinical,
            "Fully sterile operating theatre with anaesthesia equipment, surgical lights and monitors.",
            listOf(
                m(metricInfection, "100 %", OK), m(metricStaffResp, "2 min", OK),
                m(metricEquipUptime, "99 %", OK), m(metricSatisfaction, "4.8 / 5", OK)
            )
        )

        place(
            USER_DR_JAMES, coord(-3, 3), "Intensive Care Unit", LandmarkType.WATCHTOWER, groupClinical,
            "Post-operative and critical care ward with 24/7 monitoring for up to 8 patients.",
            listOf(
                m(metricEquipUptime, "99.9 %", OK), m(metricStaffResp, "1 min", OK),
                m(metricInfection, "100 %", OK), m(metricSatisfaction, "4.9 / 5", OK), m(metricWaitTime, "0 min", OK)
            )
        )

        place(
            USER_TECH_MARC, coord(3, 2), "Diagnostic Laboratory", LandmarkType.ANTENNA, groupSupport,
            "In-house blood analysis, urinalysis and microbiology with same-day results.",
            listOf(
                m(metricEquipUptime, "91 %", W), m(metricInfection, "99 %", OK),
                m(metricStaffResp, "4 min", OK), m(metricWaitTime, "35 min", W)
            )
        )

        place(
            USER_TECH_MARC, coord(5, -2), "X-Ray Room", LandmarkType.SATELLITE_DISH, groupSupport,
            "Digital radiography suite with lead-lined walls. Rapid image acquisition and PACS integration.",
            listOf(
                m(metricEquipUptime, "96 %", OK), m(metricInfection, "100 %", OK),
                m(metricStaffResp, "6 min", W), m(metricWaitTime, "18 min", W), m(metricSatisfaction, "4.2 / 5", OK)
            )
        )

        place(
            USER_NURSE_ANNA, coord(-5, 2), "Pharmacy", LandmarkType.SILO, groupSupport,
            "Licensed in-house pharmacy dispensing medications, vaccines and prescription diets.",
            listOf(
                m(metricSatisfaction, "4.7 / 5", OK), m(metricInfection, "100 %", OK),
                m(metricStaffResp, "3 min", OK), m(metricWaitTime, "5 min", OK), m(metricEquipUptime, "94 %", OK)
            )
        )

        place(
            USER_NURSE_ANNA, coord(-5, 4), "Medical Supply Storage", LandmarkType.PUMP_STATION, groupSupport,
            "Temperature-controlled storage for consumables, surgical kits and cold-chain medications.",
            listOf(m(metricEquipUptime, "88 %", W), m(metricInfection, "97 %", OK), m(metricStaffResp, "8 min", W))
        )

        place(
            USER_NURSE_ANNA, coord(2, 5), "Kennel", LandmarkType.KEEP, groupFacilities,
            "Comfortable boarding facility for dogs and cats. Individual climate-controlled suites.",
            listOf(
                m(metricSatisfaction, "4.4 / 5", OK), m(metricInfection, "95 %", OK),
                m(metricEquipUptime, "93 %", OK), m(metricStaffResp, "4 min", OK)
            )
        )

        place(
            USER_NURSE_ANNA, coord(-2, 5), "Grooming Station", LandmarkType.WINDMILL, groupFacilities,
            "Professional grooming services: bathing, trimming, nail clipping and ear cleaning.",
            listOf(
                m(metricSatisfaction, "4.8 / 5", OK), m(metricInfection, "93 %", OK),
                m(metricWaitTime, "15 min", OK), m(metricStaffResp, "2 min", OK)
            )
        )

        place(
            USER_ADMIN_PETRA, coord(4, -4), "Administration Office", LandmarkType.HOUSE, groupFacilities,
            "Management, billing, HR and compliance documentation. Petra Bauer's domain.",
            listOf(
                m(metricSatisfaction, "4.0 / 5", OK),
                m(metricStaffResp, "10 min", E),
                m(metricWaitTime, "20 min", W)
            )
        )
    }

    private fun place(
        owner: UUID,
        coordinate: HexCoordinate,
        name: String,
        type: LandmarkType,
        groupId: UUID,
        description: String,
        metrics: List<Pair<UUID, Pair<String, QualityLevel>>>,
    ) {
        val result = placeLandmarkUseCase.execute(DEMO_MAP_ID, owner, coordinate, name, type)
        val landmark = result.getLandmarkAt(coordinate)!!
        val id = landmark.id
        landmarkUuids[name] = id
        editLandmarkUseCase.execute(
            DEMO_MAP_ID, owner, id, name = null, type = null,
            description = description, groupId = groupId
        )
        metrics.forEach { (metricId, vl) ->
            setLandmarkMetricUseCase.execute(DEMO_MAP_ID, id, metricId, value = vl.first, level = vl.second, callerId = owner)
        }
    }

    private fun m(metricId: UUID, value: String, level: QualityLevel) = metricId to (value to level)

    // ── Connections ───────────────────────────────────────────────────────────
    // CreateConnectionUseCase uses AStarPathfinder internally.
    // hexLine is not needed – paths are computed correctly and landmark-aware.

    private fun createConnections() {
        connEntranceReception = conn("Main Entrance", "Reception", ConnectionType.STREET, "Main Corridor")
        connReceptionWaiting = conn("Reception", "Waiting Room", ConnectionType.STREET, "Client Flow")
        connWaitingExam1 = conn("Waiting Room", "Examination Room 1", ConnectionType.STREET, "To Exam 1")
        connWaitingExam2 = conn("Waiting Room", "Examination Room 2", ConnectionType.STREET, "To Exam 2")
        /* connExam1Surgery */  conn("Examination Room 1", "Surgery Suite", ConnectionType.PIPE, "Pre-Op Transfer")
        connExam1Lab = conn("Examination Room 1", "Diagnostic Laboratory", ConnectionType.PIPE, "Sample Delivery")
        connExam2Xray = conn("Examination Room 2", "X-Ray Room", ConnectionType.PIPE, "Imaging Request")
        /* connSurgeryIcu  */  conn("Surgery Suite", "Intensive Care Unit", ConnectionType.PIPE, "Post-Op Transfer")
        connLabPharmacy = conn("Diagnostic Laboratory", "Pharmacy", ConnectionType.TELEGRAPH, "Lab Results")
        connPharmacyStorage = conn("Pharmacy", "Medical Supply Storage", ConnectionType.PIPE, "Stock Request")
    }

    private fun conn(fromName: String, toName: String, type: ConnectionType, name: String): UUID {
        val fromId = landmarkUuids[fromName] ?: error("Landmark not found: $fromName")
        val toId = landmarkUuids[toName] ?: error("Landmark not found: $toName")
        val state = createConnectionUseCase.execute(DEMO_MAP_ID, fromId, toId, type, name, callerId = USER_ADMIN_PETRA)
        return state.connections.values.first { it.originId == fromId && it.targetId == toId }.id
    }

    // ── Processes ─────────────────────────────────────────────────────────────

    private fun createProcesses() {
        // Patient Intake
        val intakeId = createProcessUseCase.execute(
            DEMO_MAP_ID, "Patient Intake",
            "Standard workflow for receiving a new patient from arrival to examination.", USER_ADMIN_PETRA
        )
            .first { it.name == "Patient Intake" }.id

        val checkinId = addProcessStageUseCase.execute(DEMO_MAP_ID, intakeId, "Check-in", 0, USER_ADMIN_PETRA)
            .first { it.id == intakeId }.stages.first { it.name == "Check-in" }.id
        addStageConnectionUseCase.execute(
            DEMO_MAP_ID,
            intakeId,
            checkinId,
            connEntranceReception,
            "Walk-in",
            "FORWARD",
            USER_ADMIN_PETRA
        )
        addStageConnectionUseCase.execute(
            DEMO_MAP_ID,
            intakeId,
            checkinId,
            connReceptionWaiting,
            "Register",
            "FORWARD",
            USER_ADMIN_PETRA
        )

        val consultId = addProcessStageUseCase.execute(DEMO_MAP_ID, intakeId, "Consultation", 1, USER_ADMIN_PETRA)
            .first { it.id == intakeId }.stages.first { it.name == "Consultation" }.id
        addStageConnectionUseCase.execute(
            DEMO_MAP_ID,
            intakeId,
            consultId,
            connWaitingExam1,
            "Call patient",
            "FORWARD",
            USER_ADMIN_PETRA
        )
        addStageConnectionUseCase.execute(
            DEMO_MAP_ID,
            intakeId,
            consultId,
            connWaitingExam2,
            "Call patient",
            "FORWARD",
            USER_ADMIN_PETRA
        )

        // Diagnostic Workflow
        val diagId = createProcessUseCase.execute(
            DEMO_MAP_ID, "Diagnostic Workflow",
            "Process for ordering diagnostics, receiving results and dispensing treatment.", USER_ADMIN_PETRA
        )
            .first { it.name == "Diagnostic Workflow" }.id

        val orderId = addProcessStageUseCase.execute(DEMO_MAP_ID, diagId, "Order Diagnostics", 0, USER_ADMIN_PETRA)
            .first { it.id == diagId }.stages.first { it.name == "Order Diagnostics" }.id
        addStageConnectionUseCase.execute(
            DEMO_MAP_ID,
            diagId,
            orderId,
            connExam1Lab,
            "Blood / urine sample",
            "FORWARD",
            USER_ADMIN_PETRA
        )
        addStageConnectionUseCase.execute(
            DEMO_MAP_ID,
            diagId,
            orderId,
            connExam2Xray,
            "Imaging request",
            "FORWARD",
            USER_ADMIN_PETRA
        )

        val treatId =
            addProcessStageUseCase.execute(DEMO_MAP_ID, diagId, "Treatment Dispensing", 1, USER_ADMIN_PETRA)
                .first { it.id == diagId }.stages.first { it.name == "Treatment Dispensing" }.id
        addStageConnectionUseCase.execute(
            DEMO_MAP_ID,
            diagId,
            treatId,
            connLabPharmacy,
            "Prescription",
            "FORWARD",
            USER_ADMIN_PETRA
        )
        addStageConnectionUseCase.execute(
            DEMO_MAP_ID,
            diagId,
            treatId,
            connPharmacyStorage,
            "Restock medication",
            "FORWARD",
            USER_ADMIN_PETRA
        )
    }

    // ── Collaborator Matrix ───────────────────────────────────────────────────
    // NONE entries are skipped (SetMatrixEntryUseCase would write them but they add no information).

    private fun populateMatrix() {
        val H = MatrixLevel.HIGH
        val M = MatrixLevel.MEDIUM
        val L = MatrixLevel.LOW
        val N = MatrixLevel.NONE

        data class Row(
            val name: String, val s: MatrixLevel, val j: MatrixLevel,
            val a: MatrixLevel, val p: MatrixLevel, val m: MatrixLevel
        )
        listOf(
            Row("Parking Area", N, N, L, H, N),
            Row("Main Entrance", L, L, M, H, N),
            Row("Reception", L, L, M, H, N),
            Row("Waiting Room", L, L, H, M, N),
            Row("Examination Room 1", H, L, M, N, N),
            Row("Examination Room 2", L, H, M, N, N),
            Row("Surgery Suite", H, M, H, N, L),
            Row("Intensive Care Unit", M, H, H, N, M),
            Row("Diagnostic Laboratory", M, M, L, N, H),
            Row("X-Ray Room", L, M, N, N, H),
            Row("Pharmacy", M, L, H, N, L),
            Row("Medical Supply Storage", L, N, H, M, M),
            Row("Kennel", N, L, H, M, N),
            Row("Grooming Station", N, N, H, L, N),
            Row("Administration Office", N, N, L, H, L),
        ).forEach { row ->
            val lmId = landmarkUuids[row.name] ?: return@forEach
            listOf(
                USER_DR_SARAH to row.s, USER_DR_JAMES to row.j, USER_NURSE_ANNA to row.a,
                USER_ADMIN_PETRA to row.p, USER_TECH_MARC to row.m
            )
                .filter { (_, lvl) -> lvl != N }
                .forEach { (uid, lvl) ->
                    setMatrixEntryUseCase.execute(DEMO_MAP_ID, USER_ADMIN_PETRA, lmId, uid, lvl)
                }
        }
    }

    // ── Chore Lists ───────────────────────────────────────────────────────────

    private fun createChoreLists() {
        fun lm(name: String) = landmarkUuids[name] ?: error("Landmark not found: $name")

        val allLandmarks = listOf(
            "Parking Area", "Main Entrance", "Reception", "Waiting Room",
            "Examination Room 1", "Examination Room 2", "Surgery Suite",
            "Intensive Care Unit", "Diagnostic Laboratory", "X-Ray Room",
            "Pharmacy", "Medical Supply Storage", "Kennel", "Grooming Station",
            "Administration Office",
        ).map { lm(it) }
        val clinicalLandmarks = listOf(
            "Examination Room 1", "Examination Room 2", "Surgery Suite", "Intensive Care Unit",
        ).map { lm(it) }
        val facilityLandmarks = listOf(
            "Reception", "Waiting Room", "Kennel", "Grooming Station",
            "Parking Area", "Main Entrance", "Administration Office",
        ).map { lm(it) }

        // 1. Monthly infection-control audit – covers all rooms
        val auditListId = createChoreListUseCase.execute(
            DEMO_MAP_ID, "Monthly Infection-Control Audit", allLandmarks, null, null, USER_ADMIN_PETRA,
        ).first { it.title == "Monthly Infection-Control Audit" }.id

        fun updateEntry(
            listId: UUID, landmarkId: UUID,
            state: ChoreEntryState,
            assigneeId: UUID? = null, note: String? = null
        ) =
            updateChoreEntryUseCase.execute(
                sessionId = DEMO_MAP_ID,
                listId = listId,
                landmarkId = landmarkId,
                state = state,
                assigneeId = assigneeId,
                clearAssignee = false,
                link = null,
                clearLink = false,
                note = note,
                clearNote = false,
                callerId = USER_ADMIN_PETRA,
            )

        val DONE = ChoreEntryState.DONE
        val ONGOING = ChoreEntryState.ONGOING
        val BLOCKED = ChoreEntryState.BLOCKED

        updateEntry(auditListId, lm("Surgery Suite"), DONE, USER_DR_SARAH, "Sterility protocols verified – all clear.")
        updateEntry(
            auditListId,
            lm("Intensive Care Unit"),
            DONE,
            USER_DR_JAMES,
            "Equipment sterilisation log reviewed."
        )
        updateEntry(auditListId, lm("Examination Room 1"), DONE, USER_DR_SARAH)
        updateEntry(auditListId, lm("Examination Room 2"), ONGOING, USER_DR_JAMES, "Awaiting replacement of UV lamp.")
        updateEntry(auditListId, lm("Diagnostic Laboratory"), DONE, USER_TECH_MARC)
        updateEntry(auditListId, lm("X-Ray Room"), DONE, USER_TECH_MARC)
        updateEntry(auditListId, lm("Pharmacy"), DONE, USER_NURSE_ANNA)
        updateEntry(
            auditListId,
            lm("Medical Supply Storage"),
            ONGOING,
            USER_NURSE_ANNA,
            "Cold-chain thermometer calibration pending."
        )
        updateEntry(auditListId, lm("Reception"), DONE, USER_ADMIN_PETRA)
        updateEntry(auditListId, lm("Waiting Room"), DONE, USER_ADMIN_PETRA)
        updateEntry(
            auditListId,
            lm("Kennel"),
            BLOCKED,
            USER_NURSE_ANNA,
            "Blocked: deep-clean vendor rescheduled to next week."
        )
        updateEntry(auditListId, lm("Grooming Station"), DONE, USER_NURSE_ANNA)
        updateEntry(auditListId, lm("Main Entrance"), DONE, USER_ADMIN_PETRA)
        updateEntry(auditListId, lm("Parking Area"), DONE)
        updateEntry(auditListId, lm("Administration Office"), DONE, USER_ADMIN_PETRA)

        // 2. Q2 Equipment inspection – clinical + support rooms
        val equipListId = createChoreListUseCase.execute(
            DEMO_MAP_ID, "Q2 Equipment Inspection",
            clinicalLandmarks + listOf(
                lm("Diagnostic Laboratory"),
                lm("X-Ray Room"),
                lm("Pharmacy"),
                lm("Medical Supply Storage")
            ),
            "https://wiki.petclinic.demo/equipment-inspection", null, USER_TECH_MARC,
        ).first { it.title == "Q2 Equipment Inspection" }.id

        updateEntry(equipListId, lm("Examination Room 1"), DONE, USER_DR_SARAH, "Otoscope and scale calibrated.")
        updateEntry(
            equipListId,
            lm("Examination Room 2"),
            BLOCKED,
            USER_DR_JAMES,
            "ECG monitor out of service – ticket #4821 raised."
        )
        updateEntry(equipListId, lm("Surgery Suite"), DONE, USER_DR_SARAH, "Anaesthesia machine serviced by vendor.")
        updateEntry(
            equipListId,
            lm("Intensive Care Unit"),
            ONGOING,
            USER_DR_JAMES,
            "Ventilator firmware update scheduled."
        )
        updateEntry(
            equipListId,
            lm("Diagnostic Laboratory"),
            DONE,
            USER_TECH_MARC,
            "Centrifuge and analyser both passed."
        )
        updateEntry(equipListId, lm("X-Ray Room"), DONE, USER_TECH_MARC, "Detector panel alignment verified.")
        updateEntry(equipListId, lm("Pharmacy"), DONE, USER_NURSE_ANNA)
        updateEntry(
            equipListId,
            lm("Medical Supply Storage"),
            ONGOING,
            USER_NURSE_ANNA,
            "Freezer unit showing temperature drift – monitoring."
        )

        // 3. Client-area readiness – facility rooms only
        createChoreListUseCase.execute(
            DEMO_MAP_ID, "Client Area Readiness Check", facilityLandmarks, null, null, USER_ADMIN_PETRA,
        )
    }

    // ── Greenkeeping Rotations ────────────────────────────────────────────────

    private fun createGreenkeepingRotations() {
        val clinicalRotationId = createGreenkeepingRotation(
            name = "Clinical Hygiene Steward",
            description = "Weekly sterilisation walk-through for examination, surgery and ICU areas.",
            link = "https://wiki.petclinic.demo/greenkeeping/clinical-hygiene",
            groupIds = listOf(groupClinical),
            collaborators = listOf(USER_DR_SARAH, USER_DR_JAMES, USER_NURSE_ANNA),
        )
        val diagnosticsRotationId = createGreenkeepingRotation(
            name = "Diagnostics Equipment Steward",
            description = "Rotating ownership for diagnostics uptime checks, calibration follow-ups and lab readiness.",
            link = "https://wiki.petclinic.demo/greenkeeping/diagnostics-steward",
            groupIds = listOf(groupSupport),
            collaborators = listOf(USER_TECH_MARC, USER_NURSE_ANNA, USER_DR_JAMES),
        )
        val facilitiesRotationId = createGreenkeepingRotation(
            name = "Front-of-House Readiness",
            description = "Shared upkeep for reception, waiting areas and visitor-facing clinic spaces.",
            link = "https://wiki.petclinic.demo/greenkeeping/front-of-house",
            groupIds = listOf(groupFacilities),
            collaborators = listOf(USER_ADMIN_PETRA, USER_NURSE_ANNA, USER_TECH_MARC),
        )

        advanceGreenkeepingRotationUseCase.execute(DEMO_MAP_ID, clinicalRotationId, USER_ADMIN_PETRA)
        advanceGreenkeepingRotationUseCase.execute(DEMO_MAP_ID, diagnosticsRotationId, USER_ADMIN_PETRA)
        advanceGreenkeepingRotationUseCase.execute(DEMO_MAP_ID, diagnosticsRotationId, USER_ADMIN_PETRA)
        advanceGreenkeepingRotationUseCase.execute(DEMO_MAP_ID, facilitiesRotationId, USER_ADMIN_PETRA)
    }

    private fun createGreenkeepingRotation(
        name: String,
        description: String?,
        link: String?,
        groupIds: List<UUID>,
        collaborators: List<UUID>,
    ): UUID =
        createGreenkeepingRotationUseCase.execute(
            sessionId = DEMO_MAP_ID,
            name = name,
            description = description,
            link = link,
            groupIds = groupIds,
            collaborators = collaborators.map { collaboratorId ->
                GreenkeepingRotationCollaboratorPatch(collaboratorId = collaboratorId)
            },
            callerId = USER_ADMIN_PETRA,
        ).first { it.name == name }.id

    // ── Utilities ─────────────────────────────────────────────────────────────

    private fun coord(q: Int, r: Int) = HexCoordinate(q, r)
}
