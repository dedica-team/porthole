import * as THREE from 'three';
import type { HexTile } from '@/types/hex';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight, seed, LineBatcher, WIRE_MAT, TRON_CYAN_DIM, DEFAULT_TILE_COLORS, type TileColors, type TerrainRenderer } from '../terrainUtils';

// ── Static crown geometry ────────────────────────────────────────────────────
const CROWN_GEO = (() => {
  const geo = new THREE.TetrahedronGeometry(0.28, 0);
  geo.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI / 4));
  geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.atan(Math.sqrt(2))));
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
  return geo;
})();

// Max trees per tile (seed % 2 → 0 or 1 extra, so always 2 or 3)
const MAX_TREES_PER_TILE = 3;

// ── Renderer ─────────────────────────────────────────────────────────────────
export class ForestRenderer implements TerrainRenderer {
  /** Shared InstancedMesh for all crowns on the map; allocated in init(). */
  private crownInst: THREE.InstancedMesh | null = null;
  /** Next free slot index in crownInst. */
  private crownSlot = 0;
  private trunkBatcher: LineBatcher | null = null;

  tileColors(): TileColors { return DEFAULT_TILE_COLORS; }

  init(scene: THREE.Scene, maxTiles: number): THREE.Object3D[] {
    this.crownSlot = 0;
    this.crownInst = new THREE.InstancedMesh(CROWN_GEO, WIRE_MAT, maxTiles * MAX_TREES_PER_TILE);
    this.crownInst.count = 0;
    scene.add(this.crownInst);
    this.trunkBatcher = new LineBatcher(new THREE.LineBasicMaterial({ color: TRON_CYAN_DIM }));
    return [this.crownInst];
  }

  build(tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] {
    const inst = this.crownInst;
    if (!inst) return [];

    const s     = seed(tile, 31, 17, 127);
    const count = 2 + (s % 2);

    const { q, r } = tile.coordinate;
    const { x, z } = hexToWorld(q, r, 1);
    const top       = tileHeight(tile.elevation);

    const trunkPoints: number[] = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const angle  = ((s * (i + 1) * 137) % 360) * (Math.PI / 180);
      const dist   = 0.2 + ((s * (i + 3) * 53) % 100) / 200;
      const tx     = x + Math.cos(angle) * dist;
      const tz     = z + Math.sin(angle) * dist;
      const trunkH = 0.22 + ((s * (i + 7)) % 10) / 40;
      const crownR = 0.85 + ((s * (i + 11)) % 10) / 25;

      trunkPoints.push(tx, top, tz, tx, top + trunkH, tz);

      dummy.position.set(tx, top + trunkH + 0.333 * 0.28 * crownR * 1.8, tz);
      dummy.scale.set(crownR, crownR * 1.8, crownR);
      dummy.rotation.set(0, (angle * 5) % (Math.PI * 2), 0);
      dummy.updateMatrix();
      inst.setMatrixAt(this.crownSlot++, dummy.matrix);
    }
    inst.count = this.crownSlot;
    inst.instanceMatrix.needsUpdate = true;

    this.trunkBatcher?.addSegments(trunkPoints);
    return [];
  }

  flush(scene: THREE.Scene): THREE.Object3D[] {
    const ls = this.trunkBatcher?.flush(scene);
    this.trunkBatcher = null;
    return ls ? [ls] : [];
  }
}
