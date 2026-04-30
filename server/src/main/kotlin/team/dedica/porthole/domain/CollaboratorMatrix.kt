package team.dedica.porthole.domain

import java.util.concurrent.ConcurrentHashMap

enum class MatrixLevel { NONE, LOW, MEDIUM, HIGH }

data class CollaboratorMatrixEntry(val level: MatrixLevel = MatrixLevel.NONE)

data class CollaboratorMatrix(
    val name: String = "Collaborator Matrix",
    // outer key = landmarkId, inner key = collaboratorId
    val entries: MutableMap<String, MutableMap<String, CollaboratorMatrixEntry>> = ConcurrentHashMap(),
)

