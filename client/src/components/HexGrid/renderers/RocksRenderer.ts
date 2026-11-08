import * as THREE from 'three';
import type { HexTile } from '@/types/hex';
import { RockBatcher, ROCKS_TILE_COLORS, type TileColors, type TerrainRenderer } from '../terrainUtils';

export class RocksRenderer implements TerrainRenderer {

  private batcher: RockBatcher | null = null;

  tileColors(): TileColors { return ROCKS_TILE_COLORS; }

  init(_scene: THREE.Scene, _maxTiles: number): THREE.Object3D[] {
    this.batcher = new RockBatcher({ radius: 0.22, minCount: 6, countSpread: 4, heightScale: 1 });
    return [];
  }

  build(tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] {
    this.batcher?.addTile(tile);
    return [];
  }

  flush(scene: THREE.Scene): THREE.Object3D[] {
    const result = this.batcher?.flush(scene);
    this.batcher = null;
    return result ? [result.columns, result.edges] : [];
  }
}
