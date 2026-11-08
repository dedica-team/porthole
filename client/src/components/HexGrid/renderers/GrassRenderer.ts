import * as THREE from 'three';
import type { HexTile } from '@/types/hex';
import { GRASS_TILE_COLORS, type TileColors, type TerrainRenderer } from '../terrainUtils';

export class GrassRenderer implements TerrainRenderer {
  tileColors(): TileColors { return GRASS_TILE_COLORS; }
  build(_tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] { return []; }
}
