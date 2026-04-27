import * as THREE from 'three';
import type { HexTile } from '@/types/map.ts';
import { DEFAULT_TILE_COLORS, type TileColors, type TerrainRenderer } from '../terrainUtils';

export class GrassRenderer implements TerrainRenderer {
  tileColors(): TileColors { return DEFAULT_TILE_COLORS; }
  build(_tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] { return []; }
}
