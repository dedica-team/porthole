import * as THREE from 'three';
import type { HexTile } from '@/types/map.ts';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight, seed, lcgNext, RockBatcher, TRON_CYAN_DIM, WATER_TILE_COLORS, type TileColors, type TerrainRenderer } from '../terrainUtils';

const REED_UNIT_GEO = new THREE.CylinderGeometry(0.008, 0.010, 1, 3, 1);
const REED_MAT      = new THREE.MeshBasicMaterial({
  color: TRON_CYAN_DIM,
  transparent: true,
  opacity: 0.70,
  wireframe: false,
});

const MAX_REEDS_PER_TILE = 100; // 50 + (s % 51) → max 100

export class SwampRenderer implements TerrainRenderer {
  private reedInst: THREE.InstancedMesh | null = null;
  private reedSlot = 0;
  private rockBatcher: RockBatcher | null = null;

  tileColors(): TileColors { return WATER_TILE_COLORS; }

  init(scene: THREE.Scene, maxTiles: number): THREE.Object3D[] {
    this.reedSlot = 0;
    this.reedInst = new THREE.InstancedMesh(REED_UNIT_GEO, REED_MAT, maxTiles * MAX_REEDS_PER_TILE);
    this.reedInst.count = 0;
    scene.add(this.reedInst);
    this.rockBatcher = new RockBatcher({ radius: 0.10, minCount: 0, countSpread: 3, heightScale: 0.22 });
    return [this.reedInst];
  }

  build(tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] {
    const inst = this.reedInst;
    if (!inst) return [];

    // ── Reeds ──────────────────────────────────────────────────────────────
    const { q, r } = tile.coordinate;
    const { x, z } = hexToWorld(q, r, 1);
    const top = tileHeight(tile.elevation);
    const s   = seed(tile, 59, 31, 7);
    const count = 50 + (s % 51);

    let rng = s ^ 0xc0ffee;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      let angle: number, dist: number, h: number, lean: number, leanDir: number;
      [rng, angle]   = lcgNext(rng); angle   = angle   * Math.PI * 2;
      [rng, dist]    = lcgNext(rng); dist    = 0.04 + dist    * 0.72;
      [rng, h]       = lcgNext(rng); h       = 0.18 + h       * 0.22;
      [rng, lean]    = lcgNext(rng); lean    = lean    * 8 * (Math.PI / 180);
      [rng, leanDir] = lcgNext(rng); leanDir = leanDir * Math.PI * 2;

      const rx = x + Math.cos(angle) * dist;
      const rz = z + Math.sin(angle) * dist;

      dummy.position.set(rx, top + h / 2, rz);
      dummy.scale.set(1, h, 1);
      dummy.rotation.set(Math.cos(leanDir) * lean, 0, Math.sin(leanDir) * lean);
      dummy.updateMatrix();
      inst.setMatrixAt(this.reedSlot++, dummy.matrix);
    }
    inst.count = this.reedSlot;
    inst.instanceMatrix.needsUpdate = true;

    // ── Sparse rocks (~75% of tiles) ──────────────────────────────────────
    if ((seed(tile, 17, 83, 41) % 4) !== 0) {
      this.rockBatcher?.addTile(tile);
    }
    return [];
  }

  flush(scene: THREE.Scene): THREE.Object3D[] {
    const result = this.rockBatcher?.flush(scene);
    this.rockBatcher = null;
    return result ? [result.columns, result.edges] : [];
  }
}
