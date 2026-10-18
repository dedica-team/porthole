package team.dedica.porthole.application

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import team.dedica.porthole.domain.AccessDeniedException
import team.dedica.porthole.application.session.greenkeeping.EditGreenkeepingRotationUseCase
import team.dedica.porthole.application.session.greenkeeping.GreenkeepingRotationCollaboratorPatch
import team.dedica.porthole.domain.Collaborator
import team.dedica.porthole.domain.GreenkeepingRotation
import team.dedica.porthole.domain.GreenkeepingRotationCollaborator
import team.dedica.porthole.domain.HexMap
import team.dedica.porthole.domain.LandmarkGroup
import team.dedica.porthole.domain.SessionState
import java.time.Instant
import java.util.UUID

class EditGreenkeepingRotationUseCaseTest {
    private val collaboratorId = UUID.nameUUIDFromBytes("u1".toByteArray())
    private val collaborator2Id = UUID.nameUUIDFromBytes("u2".toByteArray())
    private val collaborator3Id = UUID.nameUUIDFromBytes("u3".toByteArray())
    private val viewerId = UUID.nameUUIDFromBytes("viewer".toByteArray())
    private val groupId = UUID.nameUUIDFromBytes("g1".toByteArray())
    private val group2Id = UUID.nameUUIDFromBytes("g2".toByteArray())

    private lateinit var state: SessionState
    private lateinit var mapStatePort: InMemorySessionStatePort
    private lateinit var authorizationPort: InMemoryAuthorizationPort
    private lateinit var useCase: EditGreenkeepingRotationUseCase
    private lateinit var rotation: GreenkeepingRotation
    private lateinit var entry1: GreenkeepingRotationCollaborator
    private lateinit var entry2: GreenkeepingRotationCollaborator

    @BeforeEach
    fun setup() {
        state = SessionState(map = HexMap.createHexagonal(radius = 2, elevationFn = { 1 }))
        state.collaborators += Collaborator(id = collaboratorId, username = "Alice")
        state.collaborators += Collaborator(id = collaborator2Id, username = "Bob")
        state.collaborators += Collaborator(id = collaborator3Id, username = "Carol")
        state.groups[groupId] = LandmarkGroup(id = groupId, name = "Core", color = "#00ffcc")
        state.groups[group2Id] = LandmarkGroup(id = group2Id, name = "Platform", color = "#ff00cc")

        entry1 = GreenkeepingRotationCollaborator(collaboratorId = collaboratorId, done = true)
        entry2 = GreenkeepingRotationCollaborator(collaboratorId = collaborator2Id, done = false)
        rotation = GreenkeepingRotation(
            name = "Weekly",
            description = "Old description",
            link = "https://old.example/weekly",
            updatedAt = Instant.EPOCH,
            updatedBy = collaborator2Id,
        ).apply {
            groupIds += groupId
            collaborators += entry1
            collaborators += entry2
        }
        state.greenkeepingRotations[rotation.id] = rotation

        mapStatePort = InMemorySessionStatePort().also { it.save(state) }
        authorizationPort = InMemoryAuthorizationPort(mapStatePort)
        useCase = EditGreenkeepingRotationUseCase(mapStatePort, NoOpBroadcastPort(), authorizationPort)
    }

    @Test
    fun `updates scalar fields groups and collaborator order`() {
        val result = useCase.execute(
            sessionId = state.id,
            rotationId = rotation.id,
            name = "  Renamed Weekly  ",
            description = "  New description  ",
            clearDescription = false,
            link = " https://wiki.example/greenkeeping ",
            clearLink = false,
            groupIds = listOf(group2Id),
            collaborators = listOf(
                GreenkeepingRotationCollaboratorPatch(id = entry2.id, collaboratorId = collaborator2Id),
                GreenkeepingRotationCollaboratorPatch(id = entry1.id, collaboratorId = collaboratorId),
            ),
            callerId = collaboratorId,
        )

        val saved = mapStatePort.findById(state.id)!!.greenkeepingRotations[rotation.id]!!
        assertEquals("Renamed Weekly", saved.name)
        assertEquals("New description", saved.description)
        assertEquals("https://wiki.example/greenkeeping", saved.link)
        assertEquals(listOf(group2Id), saved.groupIds)
        assertEquals(listOf(entry2.id, entry1.id), saved.collaborators.map { it.id })
        assertEquals(listOf(collaborator2Id, collaboratorId), saved.collaborators.map { it.collaboratorId })
        assertEquals(listOf(false, true), saved.collaborators.map { it.done })
        assertEquals(collaboratorId, saved.updatedBy)
        assertTrue(saved.updatedAt.isAfter(Instant.EPOCH))
        assertEquals(listOf("Renamed Weekly"), result.map { it.name })
    }

    @Test
    fun `clears description and link`() {
        useCase.execute(
            sessionId = state.id,
            rotationId = rotation.id,
            name = null,
            description = null,
            clearDescription = true,
            link = null,
            clearLink = true,
            groupIds = null,
            collaborators = null,
            callerId = collaboratorId,
        )

        val saved = mapStatePort.findById(state.id)!!.greenkeepingRotations[rotation.id]!!
        assertNull(saved.description)
        assertNull(saved.link)
    }

    @Test
    fun `changing collaborator for an existing patch id creates a fresh entry`() {
        useCase.execute(
            sessionId = state.id,
            rotationId = rotation.id,
            name = null,
            description = null,
            clearDescription = false,
            link = null,
            clearLink = false,
            groupIds = null,
            collaborators = listOf(
                GreenkeepingRotationCollaboratorPatch(id = entry1.id, collaboratorId = collaborator3Id),
            ),
            callerId = collaboratorId,
        )

        val savedEntry = mapStatePort.findById(state.id)!!.greenkeepingRotations[rotation.id]!!.collaborators.single()
        assertEquals(collaborator3Id, savedEntry.collaboratorId)
        assertNotEquals(entry1.id, savedEntry.id)
        assertFalse(savedEntry.done)
    }

    @Test
    fun `unknown rotation throws NoSuchElementException`() {
        assertThrows(NoSuchElementException::class.java) {
            useCase.execute(
                state.id,
                UUID.randomUUID(),
                "Weekly",
                null,
                false,
                null,
                false,
                null,
                null,
                collaboratorId,
            )
        }
    }

    @Test
    fun `invalid group throws IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id,
                rotation.id,
                null,
                null,
                false,
                null,
                false,
                listOf(UUID.randomUUID()),
                null,
                collaboratorId,
            )
        }
    }

    @Test
    fun `duplicate collaborators throw IllegalArgumentException`() {
        assertThrows(IllegalArgumentException::class.java) {
            useCase.execute(
                state.id,
                rotation.id,
                null,
                null,
                false,
                null,
                false,
                null,
                listOf(
                    GreenkeepingRotationCollaboratorPatch(collaboratorId = collaboratorId),
                    GreenkeepingRotationCollaboratorPatch(collaboratorId = collaboratorId),
                ),
                collaboratorId,
            )
        }
    }

    @Test
    fun `non collaborator throws AccessDeniedException`() {
        assertThrows(AccessDeniedException::class.java) {
            useCase.execute(
                state.id,
                rotation.id,
                "Hack",
                null,
                false,
                null,
                false,
                null,
                null,
                viewerId,
            )
        }
    }
}

