package team.dedica.porthole.domain

import java.util.PriorityQueue

object AStarPathfinder {

    fun findPath(
        map: HexMap,
        from: HexCoordinate,
        to: HexCoordinate,
        blockedCoordinates: Set<HexCoordinate> = emptySet(),
    ): List<HexCoordinate>? {
        if (map.getTile(from) == null || map.getTile(to) == null) return null
        if (from == to) return listOf(from)

        data class Node(val coord: HexCoordinate, val g: Int, val f: Int)

        val open = PriorityQueue<Node>(compareBy { it.f })
        val gScore = mutableMapOf(from to 0)
        val cameFrom = mutableMapOf<HexCoordinate, HexCoordinate>()

        open.add(Node(from, 0, from.distanceTo(to)))

        while (open.isNotEmpty()) {
            val current = open.poll()
            if (current.coord == to) return reconstructPath(cameFrom, to)

            for (neighbour in map.getNeighbours(current.coord)) {
                if (neighbour.coordinate in blockedCoordinates) continue
                val tentativeG = gScore.getValue(current.coord) + 1
                if (tentativeG < (gScore[neighbour.coordinate] ?: Int.MAX_VALUE)) {
                    gScore[neighbour.coordinate] = tentativeG
                    cameFrom[neighbour.coordinate] = current.coord
                    open.add(Node(neighbour.coordinate, tentativeG, tentativeG + neighbour.coordinate.distanceTo(to)))
                }
            }
        }
        return null
    }

    private fun reconstructPath(
        cameFrom: Map<HexCoordinate, HexCoordinate>,
        end: HexCoordinate,
    ): List<HexCoordinate> {
        val path = mutableListOf(end)
        var current = end
        while (cameFrom.containsKey(current)) {
            current = cameFrom.getValue(current)
            path.add(0, current)
        }
        return path
    }
}

