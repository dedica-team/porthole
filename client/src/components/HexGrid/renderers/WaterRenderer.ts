import * as THREE from 'three';
import type { HexTile } from '@/types/hex';
import {RockBatcher, seed, WATER_TILE_COLORS, type TileColors, type TerrainRenderer} from '../terrainUtils';

export class WaterRenderer implements TerrainRenderer {
    private batcher: RockBatcher | null = null;

    tileColors(): TileColors { return WATER_TILE_COLORS; }

    init(_scene: THREE.Scene, _maxTiles: number): THREE.Object3D[] {
        this.batcher = new RockBatcher({radius: 0.08, minCount: 0, countSpread: 2, heightScale: 0.18});
        return [];
    }

    build(tile: HexTile, _scene: THREE.Scene, adjacentTiles: HexTile[]): THREE.Object3D[] {
        // Rocks only appear at the water's edge — skip if fully surrounded by water
        if (adjacentTiles.every(t => t.terrain === 'WATER')) return [];
        if ((seed(tile, 23, 61, 7) % 5) >= 3) return [];
        this.batcher?.addTile(tile);
        return [];
    }

    flush(scene: THREE.Scene): THREE.Object3D[] {
        const result = this.batcher?.flush(scene);
        this.batcher = null;
        return result ? [result.columns, result.edges] : [];
    }
}
