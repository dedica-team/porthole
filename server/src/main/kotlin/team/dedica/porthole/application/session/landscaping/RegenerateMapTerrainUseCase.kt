package team.dedica.porthole.application.session.landscaping

import jakarta.inject.Singleton
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.port.BroadcastPort
import team.dedica.porthole.application.port.SessionStatePort
import team.dedica.porthole.domain.AStarPathfinder
import team.dedica.porthole.domain.MapTerrainGenerator
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.SessionState
import java.util.UUID

/**
 * Use case to regenerate map terrain from scratch based on existing session elements (landmarks and groups).
 */
@Singleton
class RegenerateMapTerrainUseCase(
    private val sessionStatePort: SessionStatePort,
    private val broadcastPort: BroadcastPort,
    private val authorizationPort: AuthorizationPort,
) {
    fun execute(
        sessionId: UUID,
        callerId: UUID,
        mapSize: String? = null,
        cols: Int? = null,
        rows: Int? = null,
        seed: Long? = null,
    ): SessionState {
        val state = authorizationPort.accessSession(callerId, sessionId, SessionRole.COLLABORATOR)
        val actualSeed = seed ?: java.util.concurrent.ThreadLocalRandom.current().nextLong()

        val (targetCols, targetRows) = when {
            cols != null && rows != null -> cols to rows
            mapSize != null -> when (mapSize.uppercase()) {
                "SMALL" -> 25 to 25
                "LARGE" -> 80 to 80
                else    -> 50 to 50
            }
            else -> null to null
        }

        val result = MapTerrainGenerator.regenerateTerrain(
            map = state.map,
            landmarks = state.landmarks.values,
            groups = state.groups.values,
            seed = actualSeed,
            cols = targetCols,
            rows = targetRows,
        )

        // Overwrite landmark coordinates with the newly clustered coordinates
        for ((lmId, updatedLm) in result.updatedLandmarks) {
            state.landmarks[lmId] = updatedLm
        }

        // Recalculate connection paths between the new landmark coordinates without removing any connections
        val allLandmarkCoords = state.landmarks.values.mapNotNull { it.coordinate }.toSet()
        state.connections.replaceAll { _, conn ->
            val originCoord = state.landmarks[conn.originId]?.coordinate
            val targetCoord = state.landmarks[conn.targetId]?.coordinate
            if (originCoord != null && targetCoord != null) {
                val blocked = allLandmarkCoords - originCoord - targetCoord
                val newPath = AStarPathfinder.findPath(result.map, originCoord, targetCoord, blocked)
                    ?: AStarPathfinder.findPath(result.map, originCoord, targetCoord, emptySet())
                    ?: listOf(originCoord, targetCoord)
                conn.copy(path = newPath)
            } else {
                conn
            }
        }

        val updated = state.copy(map = result.map)
        sessionStatePort.save(updated)
        broadcastPort.send(sessionId, updated)
        return updated
    }
}
