import * as THREE from 'three';
import type { HexTile } from '@/types/hex';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight, seed, LineBatcher, TRON_CYAN_DIM, DEFAULT_TILE_COLORS, type TileColors, type TerrainRenderer } from '../terrainUtils';

function palmFrond(
  baseX: number, baseY: number, baseZ: number,
  dirAngle: number, length: number, segments = 7,
): number[] {
  const pts: number[] = [];
  for (let k = 0; k <= segments; k++) {
    const t = k / segments;
    pts.push(
      baseX + Math.cos(dirAngle) * length * t,
      baseY - length * 0.60 * t * t,
      baseZ + Math.sin(dirAngle) * length * t,
    );
  }
  const segs: number[] = [];
  for (let k = 0; k < segments; k++) {
    segs.push(pts[k*3], pts[k*3+1], pts[k*3+2], pts[k*3+3], pts[k*3+4], pts[k*3+5]);
  }
  return segs;
}

export class BeachRenderer implements TerrainRenderer {
  private trunkBatcher: LineBatcher | null = null;
  private frondBatcher: LineBatcher | null = null;

  tileColors(): TileColors { return DEFAULT_TILE_COLORS; }

  init(_scene: THREE.Scene, _maxTiles: number): THREE.Object3D[] {
    this.trunkBatcher = new LineBatcher(new THREE.LineBasicMaterial({ color: TRON_CYAN_DIM }));
    this.frondBatcher = new LineBatcher(new THREE.LineBasicMaterial({ color: TRON_CYAN_DIM }));
    return [];
  }

  build(tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] {
    const { q, r } = tile.coordinate;
    const { x, z } = hexToWorld(q, r, 1);
    const top = tileHeight(tile.elevation);
    const s   = seed(tile, 71, 43, 17);
    const count = 1 + (s % 2);

    const trunkVerts: number[] = [];
    const frondVerts: number[] = [];

    for (let i = 0; i < count; i++) {
      const angle   = ((s * (i + 1) * 83) % 360) * (Math.PI / 180);
      const px      = x + Math.cos(angle) * ((s * (i + 3) * 61) % 45) / 100;
      const pz      = z + Math.sin(angle) * ((s * (i + 3) * 61) % 45) / 100;
      const h       = 0.5  + ((s * (i + 5) * 37) % 20) / 100;
      const tilt    = 0.15 + ((s * (i + 7) * 23) % 10) / 100;
      const tiltDir = ((s * (i + 9) * 19) % 360) * (Math.PI / 180);

      const tipX = px + Math.sin(tilt) * Math.cos(tiltDir) * h;
      const tipY = top + Math.cos(tilt) * h;
      const tipZ = pz + Math.sin(tilt) * Math.sin(tiltDir) * h;

      trunkVerts.push(px, top, pz, tipX, tipY, tipZ);

      const rotOff      = ((s * (i + 13) * 41) % 360) * (Math.PI / 180);
      const frondLength = 0.28 + ((s * (i + 17) * 29) % 12) / 100;
      for (let f = 0; f < 7; f++) {
        const fl = frondLength * (0.85 + ((s * (f + 3) * 19) % 20) / 100);
        for (const v of palmFrond(tipX, tipY, tipZ, rotOff + (f / 7) * Math.PI * 2, fl)) frondVerts.push(v);
      }
    }

    this.trunkBatcher?.addSegments(trunkVerts);
    this.frondBatcher?.addSegments(frondVerts);
    return [];
  }

  flush(scene: THREE.Scene): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    const trunk  = this.trunkBatcher?.flush(scene);
    const fronds = this.frondBatcher?.flush(scene);
    if (trunk)  objects.push(trunk);
    if (fronds) objects.push(fronds);
    this.trunkBatcher = null;
    this.frondBatcher = null;
    return objects;
  }
}
