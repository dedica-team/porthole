package team.dedica.porthole.domain

import kotlin.math.*
import java.util.UUID

/**
 * Result of terrain regeneration, containing the generated hex map and updated landmark positions.
 */
data class TerrainRegenerationResult(
    val map: HexMap,
    val updatedLandmarks: Map<UUID, Landmark>,
)

/**
 * Procedural terrain generator for hexagonal maps.
 *
 * Regenerates the entire terrain from scratch based on existing elements (landmarks, groups).
 * Distinct islands are created for each group, with natural organic shorelines,
 * realistic elevation heightmaps, and varied biome distribution.
 * All landmarks belonging to the same group are positioned close to each other on their group's island.
 */
object MapTerrainGenerator {

    /**
     * Regenerates the tiles of [map] from scratch based on [landmarks] and [groups],
     * optionally resizing the grid with [cols] and [rows].
     *
     * @param map the target HexMap containing the grid coordinates
     * @param landmarks all landmarks currently in the session
     * @param groups all landmark groups currently in the session
     * @param seed random seed for procedural noise (defaults to random)
     * @param cols optional target column count
     * @param rows optional target row count
     * @return a [TerrainRegenerationResult] with regenerated map and updated landmark coordinates
     */
    fun regenerateTerrain(
        map: HexMap,
        landmarks: Collection<Landmark> = emptyList(),
        groups: Collection<LandmarkGroup> = emptyList(),
        seed: Long = java.util.concurrent.ThreadLocalRandom.current().nextLong(),
        cols: Int? = null,
        rows: Int? = null,
    ): TerrainRegenerationResult {
        val targetMap = if (cols != null && rows != null) {
            HexMap.createBlankGrid(cols = cols.coerceIn(10, 150), rows = rows.coerceIn(10, 150))
        } else {
            map
        }

        val existingTiles = targetMap.allTiles
        if (existingTiles.isEmpty()) {
            return TerrainRegenerationResult(targetMap, landmarks.associateBy { it.id })
        }

        val noiseWarpX = PerlinNoise(seed xor 0x1234_5678L)
        val noiseWarpY = PerlinNoise(seed xor 0x8765_4321L)
        val noiseShape = PerlinNoise(seed xor 0xABCD_EF01L)
        val noiseDetail = PerlinNoise(seed xor 0x2468_ACE0L)
        val noiseElevation = PerlinNoise(seed xor 0xCAFE_BABE_0001L)
        val noiseMoisture = PerlinNoise(seed xor 0xDEAD_BEEF_0002L)

        // Find bounding box in axial / grid coordinates
        val minQ = existingTiles.minOf { it.coordinate.q }
        val maxQ = existingTiles.maxOf { it.coordinate.q }
        val minR = existingTiles.minOf { it.coordinate.r }
        val maxR = existingTiles.maxOf { it.coordinate.r }

        val totalCols = (maxQ - minQ + 1).coerceAtLeast(10)
        val minOffsetRow = existingTiles.minOf { it.coordinate.r + (it.coordinate.q - (it.coordinate.q and 1)) / 2 }
        val maxOffsetRow = existingTiles.maxOf { it.coordinate.r + (it.coordinate.q - (it.coordinate.q and 1)) / 2 }
        val totalRows = (maxOffsetRow - minOffsetRow + 1).coerceAtLeast(10)

        // Map center in Cartesian coordinates
        val centerQ = (minQ + maxQ) / 2
        val centerR = (minR + maxR) / 2
        val (mapCenterX, mapCenterY) = hexToCartesian(HexCoordinate(centerQ, centerR))
        val mapRadius = minOf(totalCols * 1.5, totalRows * sqrt(3.0)) * 0.38

        // Categorise landmarks
        val groupMap = groups.associateBy { it.id }
        val groupedLandmarks = mutableMapOf<UUID, MutableList<Landmark>>()
        val ungroupedLandmarks = mutableListOf<Landmark>()

        for (lm in landmarks) {
            val gId = lm.groupId
            if (gId != null && groupMap.containsKey(gId)) {
                groupedLandmarks.getOrPut(gId) { mutableListOf() }.add(lm)
            } else {
                ungroupedLandmarks.add(lm)
            }
        }

        data class IslandClusterSpec(
            val id: String,
            val groupId: UUID?,
            val isUngrouped: Boolean,
            val landmarksToPlace: List<Landmark>,
            val baseRadius: Double,
        )

        val clusterSpecs = mutableListOf<IslandClusterSpec>()

        val maxClusterRadius = maxOf(4.0, mapRadius * 0.65)
        val minClusterRadius = minOf(3.5, maxClusterRadius)

        // 1. Group clusters (for all defined groups)
        for (group in groups) {
            val lms = groupedLandmarks[group.id] ?: emptyList()
            val radius = (5.5 + sqrt(maxOf(1, lms.size).toDouble()) * 2.2).coerceIn(minClusterRadius, maxClusterRadius)
            clusterSpecs.add(IslandClusterSpec("group-${group.id}", group.id, false, lms, radius))
        }

        // 2. Ungrouped landmarks cluster
        if (ungroupedLandmarks.isNotEmpty()) {
            val radius = (5.0 + sqrt(ungroupedLandmarks.size.toDouble()) * 2.0).coerceIn(minClusterRadius, maxClusterRadius)
            clusterSpecs.add(IslandClusterSpec("ungrouped", null, true, ungroupedLandmarks, radius))
        }

        val rng = java.util.Random(seed)

        // 3. Procedural clusters if no groups and no ungrouped landmarks
        if (clusterSpecs.isEmpty()) {
            val count = ((totalCols * totalRows) / 350).coerceIn(2, 5)
            for (i in 0 until count) {
                val radius = 5.0 + rng.nextDouble() * 4.0
                clusterSpecs.add(IslandClusterSpec("procedural-$i", null, false, emptyList(), radius))
            }
        }

        // Layout cluster centers
        data class IslandCluster(
            val spec: IslandClusterSpec,
            val center: Pair<Double, Double>,
        )

        val clusters = mutableListOf<IslandCluster>()
        val k = clusterSpecs.size

        if (k == 1) {
            val offset = rng.nextDouble() * 2.0 - 1.0
            clusters.add(IslandCluster(clusterSpecs[0], Pair(mapCenterX + offset, mapCenterY + offset)))
        } else if (k == 2) {
            val baseAngle = rng.nextDouble() * PI
            val dist = mapRadius * (0.45 + rng.nextDouble() * 0.12)
            val c1 = Pair(mapCenterX + cos(baseAngle) * dist, mapCenterY + sin(baseAngle) * dist)
            val c2 = Pair(mapCenterX + cos(baseAngle + PI) * dist, mapCenterY + sin(baseAngle + PI) * dist)
            clusters.add(IslandCluster(clusterSpecs[0], c1))
            clusters.add(IslandCluster(clusterSpecs[1], c2))
        } else {
            val angleStep = 2.0 * PI / k
            val baseAngle = rng.nextDouble() * 2.0 * PI
            for ((idx, spec) in clusterSpecs.withIndex()) {
                val angle = baseAngle + idx * angleStep + (rng.nextDouble() * 0.25 - 0.125)
                val dist = mapRadius * (0.42 + rng.nextDouble() * 0.15)
                val cx = mapCenterX + cos(angle) * dist
                val cy = mapCenterY + sin(angle) * dist
                clusters.add(IslandCluster(spec, Pair(cx, cy)))
            }
        }

        // Generate tiles and track land tiles per cluster
        val newTiles = mutableListOf<HexTile>()
        val newTilesMap = mutableMapOf<HexCoordinate, HexTile>()
        val clusterLandTiles = mutableMapOf<String, MutableList<HexTile>>()
        val allLandTiles = mutableListOf<HexTile>()

        for (tile in existingTiles) {
            val coord = tile.coordinate
            val (x, y) = hexToCartesian(coord)

            // Domain warping for organic coastline boundaries
            val warpX = noiseWarpX.octave(x * 0.08, y * 0.08, octaves = 3, persistence = 0.5, lacunarity = 2.0) * 3.5
            val warpY = noiseWarpY.octave(x * 0.08, y * 0.08, octaves = 3, persistence = 0.5, lacunarity = 2.0) * 3.5
            val wx = x + warpX
            val wy = y + warpY

            // Secondary detail wobble
            val wobble = noiseShape.octave(x * 0.12, y * 0.12, octaves = 4, persistence = 0.5, lacunarity = 2.0) * 2.2
            val fineWobble = noiseDetail.octave(x * 0.35, y * 0.35, octaves = 2, persistence = 0.5, lacunarity = 2.0) * 0.8

            var maxInfluence = -1.0
            var dominantCluster: IslandCluster? = null
            for (cluster in clusters) {
                val dx = wx - cluster.center.first
                val dy = wy - cluster.center.second
                val dist = sqrt(dx * dx + dy * dy)
                val adjustedDist = dist - wobble - fineWobble
                val influence = 1.0 - (adjustedDist / cluster.spec.baseRadius).coerceAtLeast(0.0)
                if (influence > maxInfluence) {
                    maxInfluence = influence
                    dominantCluster = cluster
                }
            }

            val elevNoise = noiseElevation.octave(x * 0.14, y * 0.14, octaves = 4, persistence = 0.5, lacunarity = 2.0)
            val moistureNoise = noiseMoisture.octave(x * 0.09, y * 0.09, octaves = 3, persistence = 0.5, lacunarity = 2.0)
            val moisture = (moistureNoise + 1.0) / 2.0

            val (elevation, terrain) = computeTileAttributes(
                influence = maxInfluence,
                elevNoise = elevNoise,
                moisture = moisture,
                isLandmarkTile = false,
            )

            val newTile = HexTile(coordinate = coord, elevation = elevation, terrain = terrain)
            newTiles.add(newTile)
            newTilesMap[coord] = newTile

            if (elevation >= 1 && terrain != Terrain.WATER) {
                allLandTiles.add(newTile)
                if (dominantCluster != null) {
                    clusterLandTiles.getOrPut(dominantCluster.spec.id) { mutableListOf() }.add(newTile)
                }
            }
        }

        // Place landmarks for each cluster scattered across their island
        val updatedLandmarks = mutableMapOf<UUID, Landmark>()
        val usedCoordinates = mutableSetOf<HexCoordinate>()

        for (cluster in clusters) {
            val lmsToPlace = cluster.spec.landmarksToPlace
            if (lmsToPlace.isEmpty()) continue

            val clusterLand = clusterLandTiles[cluster.spec.id] ?: emptyList()
            val availableClusterLand = clusterLand.filter { it.coordinate !in usedCoordinates }

            // Candidate tiles for placement: prefer land tiles on this island cluster, fallback to all available land
            val candidateTiles = if (availableClusterLand.size >= lmsToPlace.size) {
                availableClusterLand
            } else {
                (availableClusterLand + allLandTiles.filter { it.coordinate !in usedCoordinates }).distinctBy { it.coordinate }
            }

            val assignedCoords = mutableListOf<HexCoordinate>()

            // 1. Place the first landmark near the island cluster center (or inland high-elevation tile)
            val firstTile = candidateTiles.minByOrNull {
                val (tx, ty) = hexToCartesian(it.coordinate)
                val dx = tx - cluster.center.first
                val dy = ty - cluster.center.second
                // Favor central tiles with higher elevation
                (dx * dx + dy * dy) - it.elevation * 4.0
            }

            if (firstTile != null) {
                assignedCoords.add(firstTile.coordinate)
            }

            // 2. Scatter subsequent landmarks across the island using Farthest-Point Sampling,
            // strictly ensuring landmarks in the same group (and across other groups) are not directly adjacent (distance >= 2).
            while (assignedCoords.size < lmsToPlace.size) {
                val remainingCandidates = candidateTiles.filter {
                    it.coordinate !in assignedCoords && it.coordinate !in usedCoordinates
                }
                if (remainingCandidates.isEmpty()) break

                // Tier 1: tiles with distance >= 2 from all assigned and all already used coordinates
                val nonAdjacentStrict = remainingCandidates.filter { candidate ->
                    assignedCoords.all { it.distanceTo(candidate.coordinate) >= 2 } &&
                        usedCoordinates.all { it.distanceTo(candidate.coordinate) >= 2 }
                }

                // Tier 2: tiles with distance >= 2 from assigned landmarks in this group
                val nonAdjacentGroup = remainingCandidates.filter { candidate ->
                    assignedCoords.all { it.distanceTo(candidate.coordinate) >= 2 }
                }

                val selectionPool = when {
                    nonAdjacentStrict.isNotEmpty() -> nonAdjacentStrict
                    nonAdjacentGroup.isNotEmpty() -> nonAdjacentGroup
                    else -> remainingCandidates // Fallback if island area is too constrained for distance >= 2
                }

                // Select the candidate maximizing minimum distance to already assigned landmarks to scatter them across the island
                val nextTile = selectionPool.maxByOrNull { candidate ->
                    val minDistToAssigned = assignedCoords.minOfOrNull { it.distanceTo(candidate.coordinate) } ?: 0
                    val (tx, ty) = hexToCartesian(candidate.coordinate)
                    val dx = tx - cluster.center.first
                    val dy = ty - cluster.center.second
                    val distToCenterSq = dx * dx + dy * dy
                    // Primary weight: maximize distance to other landmarks; Secondary weight: elevation & island centrality
                    minDistToAssigned * 1000.0 + candidate.elevation * 10.0 - distToCenterSq * 0.01
                } ?: remainingCandidates.first()

                assignedCoords.add(nextTile.coordinate)
            }

            // Fallback if candidates were exhausted
            if (assignedCoords.size < lmsToPlace.size) {
                val remainingCount = lmsToPlace.size - assignedCoords.size
                val fallbacks = allLandTiles
                    .filter { it.coordinate !in usedCoordinates && it.coordinate !in assignedCoords }
                    .take(remainingCount)
                assignedCoords.addAll(fallbacks.map { it.coordinate })
            }

            for ((idx, lm) in lmsToPlace.withIndex()) {
                val assignedCoord = assignedCoords.getOrNull(idx)
                    ?: throw IllegalArgumentException("Not enough land tiles to place all landmarks; choose a larger map")
                usedCoordinates.add(assignedCoord)
                updatedLandmarks[lm.id] = lm.copy(coordinate = assignedCoord)
            }
        }

        return TerrainRegenerationResult(HexMap(newTiles), updatedLandmarks)
    }

    /**
     * Computes the elevation (0..5) and Terrain enum based on island influence, noise, and moisture.
     * Ensures level 0 is strictly WATER, and all land tiles (elevation >= 1) have non-water terrain.
     */
    private fun computeTileAttributes(
        influence: Double,
        elevNoise: Double,
        moisture: Double,
        isLandmarkTile: Boolean,
    ): Pair<Int, Terrain> {
        // Landmark tiles must ALWAYS be on land
        val effectiveInfluence = if (isLandmarkTile) maxOf(influence, 0.45) else influence

        // Water threshold: level 0 is water
        if (effectiveInfluence < 0.20) {
            return Pair(0, Terrain.WATER)
        }

        // Shoreline / Coastal beach
        if (effectiveInfluence < 0.38) {
            val terrain = if (moisture > 0.80) Terrain.SWAMP else Terrain.BEACH
            return Pair(1, terrain)
        }

        // Inland elevation calculation based on distance from coast + elevation noise
        // Interior influence maps 0.38..1.0 -> 0.0..1.0
        val interiorProgress = ((effectiveInfluence - 0.38) / 0.62).coerceIn(0.0, 1.0)
        val rawElev = 1.5 + interiorProgress * 2.8 + elevNoise * 1.5
        val elevation = rawElev.roundToInt().coerceIn(1, 5)

        val terrain = when (elevation) {
            0 -> Terrain.WATER
            1 -> if (moisture > 0.70) Terrain.SWAMP else Terrain.BEACH
            2 -> when {
                moisture < 0.20 -> Terrain.DESERT
                moisture < 0.45 -> Terrain.MEADOW
                moisture < 0.80 -> Terrain.GRASS
                else -> Terrain.FOREST
            }
            3 -> when {
                moisture < 0.25 -> Terrain.GRASS
                moisture < 0.70 -> Terrain.FOREST
                else -> Terrain.SWAMP
            }
            4 -> when {
                moisture < 0.35 -> Terrain.ROCKS
                moisture < 0.75 -> Terrain.FOREST
                else -> Terrain.ROCKS
            }
            5 -> when {
                moisture < 0.30 -> Terrain.ROCKS
                moisture < 0.70 -> Terrain.SNOWY
                else -> Terrain.ICE
            }
            else -> Terrain.GRASS
        }

        // Invariant: level 0 is water, elevation >= 1 is non-water
        return if (elevation == 0 || terrain == Terrain.WATER) {
            Pair(0, Terrain.WATER)
        } else {
            Pair(elevation, terrain)
        }
    }

    /**
     * Converts axial hex coordinates (q, r) to 2D isotropic Cartesian coordinates (x, y).
     * In flat-top layout:
     *   x = 1.5 * q
     *   y = sqrt(3)/2 * q + sqrt(3) * r = sqrt(3) * (r + q / 2.0)
     */
    private fun hexToCartesian(coord: HexCoordinate): Pair<Double, Double> {
        val x = 1.5 * coord.q
        val y = sqrt(3.0) * (coord.r + coord.q / 2.0)
        return Pair(x, y)
    }
}
