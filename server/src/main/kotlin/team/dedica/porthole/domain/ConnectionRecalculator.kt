package team.dedica.porthole.domain

import java.util.UUID

/**
 * Domain service that keeps connection paths consistent after landmarks are added or moved.
 *
 * Two operations are provided:
 *
 * - [recalculateConnectionsCrossingTile] – reroutes every connection whose stored path passes
 *   through a tile that has just become occupied by a landmark.  Used by both
 *   [PlaceLandmarkUseCase] and [PositionLandmarkUseCase].
 *
 * - [recalculateConnectionsInvolvingLandmark] – recalculates connections whose origin or target
 *   is the landmark that was just repositioned (its endpoint has moved).
 *   Used by [PositionLandmarkUseCase].
 *
 * Both helpers leave a connection unchanged if A* cannot find an alternative path.
 */
object ConnectionRecalculator {

    /**
     * For every connection in [state] whose path contains [blockedTile] (as an intermediate or
     * endpoint that is NOT that connection's own origin/target), reroute the connection avoiding
     * [blockedTile].
     */
    fun recalculateConnectionsCrossingTile(state: SessionState, blockedTile: HexCoordinate) {
        // Collect all occupied landmark tiles so they can be used as global blockers.
        val allLandmarkCoords = state.landmarks.values.mapNotNull { it.coordinate }.toSet()

        state.connections.entries
            .filter { (_, c) -> c.path.contains(blockedTile) }
            .forEach { (connId, c) ->
                val originCoord  = state.landmarks[c.originId]?.coordinate  ?: return@forEach
                val targetCoord  = state.landmarks[c.targetId]?.coordinate  ?: return@forEach

                // Only reroute if the blocked tile is not one of the connection's own endpoints.
                if (blockedTile == originCoord || blockedTile == targetCoord) return@forEach

                // Block all landmarks except this connection's own two endpoints.
                val blocked = allLandmarkCoords - originCoord - targetCoord

                val newPath = AStarPathfinder.findPath(state.map, originCoord, targetCoord, blocked)
                    ?: return@forEach  // leave stale path if no route; callers can enforce a policy
                state.connections[connId] = c.copy(path = newPath)
            }
    }

    /**
     * Recalculate paths for all connections whose [Connection.originId] or [Connection.targetId]
     * matches [landmarkId].  Call this after the landmark has already been updated in [state]
     * (so [state.landmarks[landmarkId].coordinate] reflects the new position).
     */
    fun recalculateConnectionsInvolvingLandmark(state: SessionState, landmarkId: UUID) {
        val movedLandmark = state.landmarks[landmarkId] ?: return
        val movedCoord    = movedLandmark.coordinate    ?: return

        val allLandmarkCoords = state.landmarks.values.mapNotNull { it.coordinate }.toSet()

        state.connections.entries
            .filter { (_, c) -> c.originId == landmarkId || c.targetId == landmarkId }
            .forEach { (connId, c) ->
                val originCoord = if (c.originId == landmarkId) movedCoord else state.landmarks[c.originId]?.coordinate ?: return@forEach
                val targetCoord = if (c.targetId == landmarkId) movedCoord else state.landmarks[c.targetId]?.coordinate ?: return@forEach

                val blocked = allLandmarkCoords - originCoord - targetCoord

                val newPath = AStarPathfinder.findPath(state.map, originCoord, targetCoord, blocked)
                    ?: return@forEach
                state.connections[connId] = c.copy(path = newPath)
            }
    }
}

