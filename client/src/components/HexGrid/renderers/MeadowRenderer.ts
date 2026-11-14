import * as THREE from 'three';
import type { HexTile } from '@/types/hex';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight, seed, lcgNext, LineBatcher, MEADOW_TILE_COLORS, type TileColors, type TerrainRenderer } from '../terrainUtils';

const STEM_COLOR = new THREE.Color(0x006622);
const FLOWER_MAT = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });

export class MeadowRenderer implements TerrainRenderer {
  private lineBatcher: LineBatcher | null = null;

  tileColors(): TileColors { return MEADOW_TILE_COLORS; }

  init(_scene: THREE.Scene, _maxTiles: number): THREE.Object3D[] {
    this.lineBatcher = new LineBatcher(FLOWER_MAT, true);
    return [];
  }

  build(tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] {
    const verts:  number[] = [];
    const colors: number[] = [];
    const R       = 0.78;
    const sqrt3_2 = Math.sqrt(3) / 2;
    const tmp     = new THREE.Color();

    const { q, r } = tile.coordinate;
    const { x, z } = hexToWorld(q, r, 1);
    const top = tileHeight(tile.elevation);

    let rng = seed(tile, 73, 41, 61);
    let v: number;
    [rng, v] = lcgNext(rng);
    const count = 18 + Math.floor(v * 5);

    let placed = 0, attempts = 0;
    while (placed < count && attempts < count * 6) {
      attempts++;
      let lx: number, lz: number, lh: number, llean: number, lleanD: number, hue: number, rotOff: number;
      [rng, lx]     = lcgNext(rng); lx     = (lx * 2 - 1) * R;
      [rng, lz]     = lcgNext(rng); lz     = (lz * 2 - 1) * R;
      [rng, lh]     = lcgNext(rng);
      [rng, llean]  = lcgNext(rng);
      [rng, lleanD] = lcgNext(rng);
      [rng, hue]    = lcgNext(rng);
      [rng, rotOff] = lcgNext(rng);

      if (Math.abs(lx) > R) continue;
      if (0.5 * Math.abs(lx) + sqrt3_2 * Math.abs(lz) > sqrt3_2 * R) continue;

      const bx   = x + lx;
      const bz   = z + lz;
      const h    = 0.035 + lh * 0.05;
      const lean = llean * 8 * (Math.PI / 180);
      const lDir = lleanD * Math.PI * 2;
      const tipX = bx + Math.sin(lean) * Math.cos(lDir) * h;
      const tipZ = bz + Math.sin(lean) * Math.sin(lDir) * h;
      const tipY = top + Math.cos(lean) * h;

      verts.push(bx, top, bz, tipX, tipY, tipZ);
      colors.push(STEM_COLOR.r, STEM_COLOR.g, STEM_COLOR.b, STEM_COLOR.r, STEM_COLOR.g, STEM_COLOR.b);

      tmp.setHSL(hue, 1.0, 0.62);
      const petalL = h * 0.50;
      const pOff   = rotOff * Math.PI * 2;
      for (let p = 0; p < 6; p++) {
        const pa = pOff + (p / 6) * Math.PI * 2;
        verts.push(tipX, tipY, tipZ, tipX + Math.cos(pa) * petalL, tipY, tipZ + Math.sin(pa) * petalL);
        colors.push(tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b);
      }
      placed++;
    }

    this.lineBatcher?.addSegments(verts, colors);
    return [];
  }

  flush(scene: THREE.Scene): THREE.Object3D[] {
    const ls = this.lineBatcher?.flush(scene);
    this.lineBatcher = null;
    return ls ? [ls] : [];
  }
}
