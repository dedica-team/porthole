import type { HexTile } from '@/types/hex';

/**
 * Stable key for all HexGrid layers that only depend on tile geometry/terrain.
 *
 * Intentionally depends only on fields that affect tile rendering so effects do
 * not rebuild expensive Three.js layers on irrelevant payload reshaping.
 *
 * Tile order remains significant because merged geometry and picking logic depend
 * on the array order used by the scene build.
 */
export function createTileRenderKey(tiles: readonly HexTile[]): string {
  return tiles
    .map((tile) => `${tile.coordinate.q},${tile.coordinate.r},${tile.elevation},${tile.terrain}`)
    .join('|');
}

