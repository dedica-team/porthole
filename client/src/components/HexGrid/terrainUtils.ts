/**
 * Shared utilities, materials and helpers used across all terrain renderers.
 */
import * as THREE from 'three';
import type { HexTile } from '@/types/map.ts';
import { hexToWorld } from '@/utils/hexUtils.ts';

// ── Tron palette ──────────────────────────────────────────────────────────────
export const TRON_CYAN     = 0x00f0ff;
export const TRON_CYAN_DIM = 0x006070;
export const TRON_BLACK    = 0x040810;
export const EDGE_COLOR      = TRON_CYAN;
/** Darker edge colour used for water and swamp tiles. */
export const EDGE_COLOR_DARK = 0x004455;

/** Shared wireframe material – one draw-call per InstancedMesh. */
export const WIRE_MAT = new THREE.MeshBasicMaterial({
  color: TRON_CYAN_DIM,
  wireframe: true,
  transparent: true,
  opacity: 0.3,
});

// ── Shared line materials (reused across renderers) ───────────────────────────
export const LINE_BRIGHT = new THREE.LineBasicMaterial({
  color: TRON_CYAN,
  transparent: true,
  opacity: 0.65,
});
export const LINE_DIM = new THREE.LineBasicMaterial({
  color: TRON_CYAN_DIM,
  transparent: true,
  opacity: 0.75,
});

// ── TileColors ────────────────────────────────────────────────────────────────
export interface TileColors {
  topColor:      number;
  topEmissive:   THREE.Color;
  topRoughness:  number;
  topMetalness:  number;
  sideColor:     number;
  sideEmissive:  THREE.Color;
  sideRoughness: number;
  sideMetalness: number;
}

// Default tile colours (used by most terrain types)
export const DEFAULT_TILE_COLORS: TileColors = {
  topColor:      TRON_BLACK,
  topEmissive:   new THREE.Color(TRON_CYAN_DIM).multiplyScalar(0.06),
  topRoughness:  1.0,
  topMetalness:  0.0,
  sideColor:     TRON_BLACK,
  sideEmissive:  new THREE.Color(TRON_CYAN_DIM).multiplyScalar(0.03),
  sideRoughness: 1.0,
  sideMetalness: 0.0,
};

export const WATER_TILE_COLORS: TileColors = {
  topColor:      0x010a0f,
  topEmissive:   new THREE.Color(0x003850).multiplyScalar(0.55),
  topRoughness:  0.08,
  topMetalness:  0.65,
  sideColor:     0x010a0f,
  sideEmissive:  new THREE.Color(0x003850).multiplyScalar(0.25),
  sideRoughness: 0.15,
  sideMetalness: 0.45,
};

export const SNOWY_TILE_COLORS: TileColors = {
  topColor:      0x2a3d4a,
  topEmissive:   new THREE.Color(0x6688aa).multiplyScalar(0.07),
  topRoughness:  0.95,
  topMetalness:  0.0,
  sideColor:     0x1a2a35,
  sideEmissive:  new THREE.Color(0x445566).multiplyScalar(0.05),
  sideRoughness: 0.95,
  sideMetalness: 0.0,
};

// ── TerrainRenderer interface ─────────────────────────────────────────────────
export interface TerrainRenderer {
  /** Returns the tile surface & side colours for this terrain type. */
  tileColors(): TileColors;

  /** Called once before the build loop.  Renderers that want to pre-allocate
   *  shared GPU resources (e.g. a single InstancedMesh for the whole map) can
   *  do so here.  maxTiles is an upper bound on how many tiles of this terrain
   *  type will be built.  Returns any scene objects that were added so the
   *  caller can own and dispose them; return [] when nothing was added. */
  init?(scene: THREE.Scene, maxTiles: number): THREE.Object3D[];

  /** Build vegetation/decoration for a single tile.  Renderers that batch
   *  across tiles accumulate data in build() and create GPU objects lazily;
   *  they must NOT return any new scene objects here in that case (return []).
   *  Renderers that still create per-tile objects return them here as before. */
  build(tile: HexTile, scene: THREE.Scene, adjacentTiles: HexTile[]): THREE.Object3D[];

  /** Called once after all build() calls.  Renderers that deferred GPU-object
   *  creation (to merge all tiles into a single draw-call) create and add
   *  their objects here.  The caller owns them and is responsible for disposal.
   *  Returning [] (the default) means the renderer has nothing deferred. */
  flush?(scene: THREE.Scene): THREE.Object3D[];
}

// ── tileHeight ────────────────────────────────────────────────────────────────
export function tileHeight(elevation: number): number {
  return 0.2 + elevation * 0.25;
}

// ── remove helper ─────────────────────────────────────────────────────────────
export function remove(scene: THREE.Scene, ...meshes: Array<THREE.InstancedMesh | null>) {
  for (const m of meshes) if (m) scene.remove(m);
}

// ── Deterministic seed ────────────────────────────────────────────────────────
export function seed(tile: import('../../types/map').HexTile, a: number, b: number, c: number): number {
  return (tile.coordinate.q * a + tile.coordinate.r * b + c) & 0xffff;
}

// ── Shared line-segment geometry builder ──────────────────────────────────────
export function lineGeo(verts: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return g;
}

// ── LCG pseudo-random noise ───────────────────────────────────────────────────
export function lcgNext(state: number): [number, number] {
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return [next, next / 0x100000000];
}

// ── Shared rock geometry & materials (reused by RocksRenderer, SwampRenderer, WaterRenderer) ──
export const ROCK_COL_GEO = new THREE.CylinderGeometry(1, 1, 1, 6);
ROCK_COL_GEO.rotateY(Math.PI / 6);

/**
 * Pre-computed edge pairs for a unit hex-cylinder (radius=1, height=1, 6 sides).
 * 24 line segments = 6 top + 6 bottom + 12 vertical edges.
 * Each entry is [ax,ay,az, bx,by,bz] in local space (y: -0.5 … +0.5).
 * Used by placeRocks to avoid per-rock clone()+EdgesGeometry() allocation.
 */
const ROCK_EDGE_PAIRS: Float32Array = (() => {
  const eg  = new THREE.EdgesGeometry(ROCK_COL_GEO);
  const buf = (eg.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const out = new Float32Array(buf.length);
  out.set(buf);
  eg.dispose();
  return out;
})();
const ROCK_EDGE_STRIDE = 6; // 2 vertices × 3 components per segment
const ROCK_EDGE_COUNT  = ROCK_EDGE_PAIRS.length / ROCK_EDGE_STRIDE;

export const ROCK_MAT = new THREE.MeshStandardMaterial({
  color:     TRON_BLACK,
  emissive:  new THREE.Color(0x007888).multiplyScalar(0.06),
  roughness: 1.0,
  metalness: 0.0,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});

export const ROCK_EDGE_MAT = new THREE.LineBasicMaterial({ color: TRON_CYAN });

export const SNOW_MOUND_MAT = new THREE.MeshStandardMaterial({
  color:      0x8899a8,
  emissive:   new THREE.Color(0x7799aa).multiplyScalar(0.12),
  roughness:  0.95,
  metalness:  0.0,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});

export interface RockPlacementOptions {
  /** Base radius of each rock column (XZ scale). Default 0.22. */
  radius?: number;
  /** Minimum rocks per tile (can be 0 to allow empty tiles). Default 6. */
  minCount?: number;
  /** Random spread added on top of minCount (s % spread). Default 4. */
  countSpread?: number;
  /** Scale factor applied to rock heights. Default 1. */
  heightScale?: number;
}

// ── RockBatcher ───────────────────────────────────────────────────────────────
/**
 * Accumulates rock data across many addTile() calls and emits a single
 * InstancedMesh + LineSegments via flush().  One batcher = one draw-call pair.
 */
export class RockBatcher {
  private readonly opts: Required<RockPlacementOptions>;
  private readonly matrices: THREE.Matrix4[] = [];
  private readonly edgeVerts: number[] = [];
  private readonly _dummy  = new THREE.Object3D();
  private readonly _va     = new THREE.Vector3();
  private readonly _vb     = new THREE.Vector3();

  constructor(opts: RockPlacementOptions = {}) {
    this.opts = {
      radius:      opts.radius      ?? 0.22,
      minCount:    opts.minCount    ?? 6,
      countSpread: opts.countSpread ?? 4,
      heightScale: opts.heightScale ?? 1,
    };
  }

  addTile(tile: HexTile): void {
    const { radius, minCount, countSpread, heightScale } = this.opts;
    const { q, r } = tile.coordinate;
    const { x, z } = hexToWorld(q, r, 1);
    const top    = tileHeight(tile.elevation);
    const s      = seed(tile, 53, 29, 91);
    const count  = minCount + (s % (countSpread + 1));
    const hSlice = 30 / Math.max(count, 1);

    for (let i = 0; i < count; i++) {
      const angle   = ((s * (i + 1) * 137 + i * 73) % 360) * (Math.PI / 180);
      const dist    = 0.05 + ((s * (i + 3) * 59 + i * 41) % 55) / 100;
      const hBucket = i * hSlice;
      const hOffset = ((s * (i + 7) * 31 + i * 23) % Math.max(1, Math.floor(hSlice)));
      const h       = (0.15 + (hBucket + hOffset) / 100) * heightScale;
      const rotY    = ((s * (i + 9) * 73) % 360) * (Math.PI / 180);

      this._dummy.position.set(x + Math.cos(angle) * dist, top + h / 2, z + Math.sin(angle) * dist);
      this._dummy.scale.set(radius, h, radius);
      this._dummy.rotation.set(0, rotY, 0);
      this._dummy.updateMatrix();
      this.matrices.push(this._dummy.matrix.clone());

      const m = this._dummy.matrix;
      for (let e = 0; e < ROCK_EDGE_COUNT; e++) {
        const base = e * ROCK_EDGE_STRIDE;
        this._va.set(ROCK_EDGE_PAIRS[base],     ROCK_EDGE_PAIRS[base + 1], ROCK_EDGE_PAIRS[base + 2]);
        this._vb.set(ROCK_EDGE_PAIRS[base + 3], ROCK_EDGE_PAIRS[base + 4], ROCK_EDGE_PAIRS[base + 5]);
        this._va.applyMatrix4(m); this._vb.applyMatrix4(m);
        this.edgeVerts.push(
          this._va.x, this._va.y, this._va.z,
          this._vb.x, this._vb.y, this._vb.z,
        );
      }
    }
  }

  /** Emits InstancedMesh + LineSegments.  Returns null when no rocks were added. */
  flush(scene: THREE.Scene): { columns: THREE.InstancedMesh; edges: THREE.LineSegments } | null {
    const total = this.matrices.length;
    if (total === 0) return null;

    const inst = new THREE.InstancedMesh(ROCK_COL_GEO, ROCK_MAT, total);
    for (let i = 0; i < total; i++) inst.setMatrixAt(i, this.matrices[i]);
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(this.edgeVerts, 3));
    const edges = new THREE.LineSegments(edgeGeo, ROCK_EDGE_MAT);
    scene.add(edges);

    return { columns: inst, edges };
  }
}

// ── LineBatcher ───────────────────────────────────────────────────────────────
/**
 * Accumulates line-segment vertices across many addSegments() calls and
 * emits a single LineSegments object via flush().
 */
export class LineBatcher {
  private readonly verts: number[] = [];
  private readonly colors: number[] | null;
  private readonly mat: THREE.LineBasicMaterial | THREE.Material;

  constructor(mat: THREE.LineBasicMaterial | THREE.Material, useVertexColors = false) {
    this.mat    = mat;
    this.colors = useVertexColors ? [] : null;
  }

  addSegments(verts: number[], colors?: number[]): void {
    for (const v of verts) this.verts.push(v);
    if (this.colors && colors) for (const c of colors) this.colors.push(c);
  }

  /** Creates and adds a single LineSegments.  Returns null when empty. */
  flush(scene: THREE.Scene): THREE.LineSegments | null {
    if (this.verts.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.verts, 3));
    if (this.colors?.length) {
      geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    }
    const ls = new THREE.LineSegments(geo, this.mat);
    scene.add(ls);
    return ls;
  }
}

// ── PointsBatcher ─────────────────────────────────────────────────────────────
/**
 * Accumulates Points data across many addPoints() calls and emits a single
 * THREE.Points object via flush().
 */
export class PointsBatcher {
  readonly positions: number[] = [];
  readonly extras: Map<string, number[]> = new Map();
  private readonly mat: THREE.Material;

  constructor(mat: THREE.Material) { this.mat = mat; }

  addPoint(x: number, y: number, z: number, extraAttribs?: Record<string, number>): void {
    this.positions.push(x, y, z);
    if (extraAttribs) {
      for (const [k, v] of Object.entries(extraAttribs)) {
        if (!this.extras.has(k)) this.extras.set(k, []);
        this.extras.get(k)!.push(v);
      }
    }
  }

  /** Creates and adds a single Points object.  Returns null when empty. */
  flush(scene: THREE.Scene): THREE.Points | null {
    if (this.positions.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    for (const [k, arr] of this.extras) {
      geo.setAttribute(k, new THREE.Float32BufferAttribute(arr, 1));
    }
    const pts = new THREE.Points(geo, this.mat);
    scene.add(pts);
    return pts;
  }
}

/** Builds and adds rock InstancedMesh + edge LineSegments to the scene.
 *  Returns the two objects so the caller can store and dispose them.
 *  Returns null if all tiles produce zero rocks.
 *  @deprecated Prefer RockBatcher for map-wide batching. */
export function placeRocks(
  tiles: HexTile[],
  scene: THREE.Scene,
  opts: RockPlacementOptions = {},
): { columns: THREE.InstancedMesh; edges: THREE.LineSegments } | null {
  const batcher = new RockBatcher(opts);
  tiles.forEach((t) => batcher.addTile(t));
  return batcher.flush(scene);
}

