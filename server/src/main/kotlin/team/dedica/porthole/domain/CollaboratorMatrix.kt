package team.dedica.porthole.domain

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

enum class MatrixLevel { NONE, LOW, MEDIUM, HIGH }

data class CollaboratorMatrixEntry(val level: MatrixLevel = MatrixLevel.NONE)

data class CollaboratorMatrix(
    val name: String = "Collaborator Matrix",
    val collaborators: MutableList<UUID> = mutableListOf(),
    // outer key = landmarkId, inner key = collaboratorId
    val entries: MutableMap<UUID, MutableMap<UUID, CollaboratorMatrixEntry>> = ConcurrentHashMap(),
)

