import * as THREE from 'three';
import type { HexTile } from '@/types/hex';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight, seed, lcgNext, LineBatcher, PointsBatcher, SNOWY_TILE_COLORS, SNOW_MOUND_MAT, ROCK_EDGE_MAT, type TileColors, type TerrainRenderer } from '../terrainUtils';

const SNOW_MOUND_GEO = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
  g.rotateY(Math.PI / 6);
  return g;
})();


// ── Shimmer shader (icy palette) ──────────────────────────────────────────────
const ICY_VERT = /* glsl */`
  attribute float aPhase;
  attribute float aSpeed;
  varying vec3 vColor;

  vec3 icyStop(int i) {
    if (i == 0) return vec3(0.55, 0.80, 1.00); // pale blue
    if (i == 1) return vec3(0.75, 0.92, 1.00); // ice white-blue
    if (i == 2) return vec3(0.85, 0.97, 1.00); // near white
               return vec3(0.40, 0.70, 0.95);  // deeper blue
  }

  float hash1(float n) { return fract(sin(n) * 43758.5453123); }

  uniform float uTime;
  uniform float uSize;

  void main() {
    float elapsed = aPhase + uTime * aSpeed;
    float cycle   = floor(elapsed);
    float t       = fract(elapsed);

    int fromIdx = int(floor(hash1(cycle)         * 4.0));
    int toIdx   = int(floor(hash1(cycle + 137.0) * 4.0));

    vec3 a = icyStop(fromIdx);
    vec3 b = icyStop(toIdx);
    vColor = mix(a, b, smoothstep(0.0, 1.0, t));

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (1.0 / -mvPosition.z);
    gl_Position  = projectionMatrix * mvPosition;
  }
`;

const ICY_FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    vec2  uv   = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
    gl_FragColor = vec4(vColor * alpha, alpha * 0.85);
  }
`;

export const icyShimmerUniforms = { uTime: { value: 0.0 }, uSize: { value: 25.0 } };

export const ICY_SHIMMER_MAT = new THREE.ShaderMaterial({
  uniforms:       icyShimmerUniforms,
  vertexShader:   ICY_VERT,
  fragmentShader: ICY_FRAG,
  transparent:    true,
  blending:       THREE.AdditiveBlending,
  depthWrite:     false,
});

ICY_SHIMMER_MAT.onBeforeRender = () => {
  icyShimmerUniforms.uTime.value = performance.now() / 1000;
};

// ── Shared helper: build shimmer Points for a set of tiles ───────────────────
export function buildIcyShimmer(
  tiles: HexTile[],
  scene: THREE.Scene,
  pointsPerTile: [number, number], // [min, spread]
  seedArgs: [number, number, number],
): THREE.Points {
  const [minPts, spread] = pointsPerTile;
  const [sa, sb, sc] = seedArgs;

  const batcher = new PointsBatcher(ICY_SHIMMER_MAT);
  const R       = 0.78;
  const sqrt3_2 = Math.sqrt(3) / 2;

  tiles.forEach((tile) => {
    const { q, r } = tile.coordinate;
    const { x, z } = hexToWorld(q, r, 1);
    const y = tileHeight(tile.elevation) + 0.004;
    let rng = seed(tile, sa, sb, sc) ^ 0xbeef;

    let v: number; [rng, v] = lcgNext(rng);
    const count = minPts + Math.floor(v * spread);

    let placed = 0, attempts = 0;
    while (placed < count && attempts < count * 6) {
      attempts++;
      let lx: number, lz: number, phase: number, speed: number;
      [rng, lx]    = lcgNext(rng); lx    = (lx * 2 - 1) * R;
      [rng, lz]    = lcgNext(rng); lz    = (lz * 2 - 1) * R;
      [rng, phase] = lcgNext(rng); phase = phase * 4.0;
      [rng, speed] = lcgNext(rng); speed = 0.2 + speed * 1.2;

      if (Math.abs(lx) > R) continue;
      if (0.5 * Math.abs(lx) + sqrt3_2 * Math.abs(lz) > sqrt3_2 * R) continue;

      batcher.addPoint(x + lx, y, z + lz, { aPhase: phase, aSpeed: speed });
      placed++;
    }
  });

  return batcher.flush(scene) as THREE.Points;
}

const MAX_MOUNDS_PER_TILE = 18; // 10 + (v * 9) → max 18

// Pre-computed edge pairs for SNOW_MOUND_GEO (same trick as placeRocks)
const MOUND_EDGE_PAIRS: Float32Array = (() => {
  const eg  = new THREE.EdgesGeometry(SNOW_MOUND_GEO);
  const buf = (eg.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const out = new Float32Array(buf.length);
  out.set(buf);
  eg.dispose();
  return out;
})();
const MOUND_EDGE_STRIDE = 6;
const MOUND_EDGE_COUNT  = MOUND_EDGE_PAIRS.length / MOUND_EDGE_STRIDE;

export class SnowyRenderer implements TerrainRenderer {
  private moundInst: THREE.InstancedMesh | null = null;
  private moundSlot = 0;
  private edgeBatcher: LineBatcher | null = null;
  private shimmerTiles: HexTile[] = [];

  tileColors(): TileColors { return SNOWY_TILE_COLORS; }

  init(scene: THREE.Scene, maxTiles: number): THREE.Object3D[] {
    this.moundSlot = 0;
    this.moundInst = new THREE.InstancedMesh(SNOW_MOUND_GEO, SNOW_MOUND_MAT, maxTiles * MAX_MOUNDS_PER_TILE);
    this.moundInst.count = 0;
    scene.add(this.moundInst);
    this.edgeBatcher  = new LineBatcher(ROCK_EDGE_MAT);
    this.shimmerTiles = [];
    return [this.moundInst];
  }

  build(tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] {
    const inst = this.moundInst;
    if (!inst) return [];

    const dummy     = new THREE.Object3D();
    const edgeVerts: number[] = [];
    const R       = 0.78;
    const sqrt3_2 = Math.sqrt(3) / 2;

    const { q, r } = tile.coordinate;
    const { x, z } = hexToWorld(q, r, 1);
    const top = tileHeight(tile.elevation);

    let rng = seed(tile, 53, 79, 31) ^ 0xdeadbeef;
    let v: number;
    [rng, v] = lcgNext(rng);
    const count = 10 + Math.floor(v * 9);

    const _va = new THREE.Vector3();
    const _vb = new THREE.Vector3();

    let placed = 0, attempts = 0;
    while (placed < count && attempts < count * 5) {
      attempts++;
      let rx: number, rz: number, rh: number, rw: number, rrot: number;
      [rng, rx]   = lcgNext(rng);
      [rng, rz]   = lcgNext(rng);
      [rng, rh]   = lcgNext(rng);
      [rng, rw]   = lcgNext(rng);
      [rng, rrot] = lcgNext(rng);

      const lx = (rx * 2 - 1) * R;
      const lz = (rz * 2 - 1) * R;
      if (Math.abs(lx) > R) continue;
      if (0.5 * Math.abs(lx) + sqrt3_2 * Math.abs(lz) > sqrt3_2 * R) continue;

      const w    = 0.12 + rw  * 0.16;
      const h    = 0.03 + rh  * 0.04;
      const rotY = rrot * Math.PI * 2;

      dummy.position.set(x + lx, top + h / 2, z + lz);
      dummy.scale.set(w, h, w);
      dummy.rotation.set(0, rotY, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(this.moundSlot++, dummy.matrix);

      const m = dummy.matrix;
      for (let e = 0; e < MOUND_EDGE_COUNT; e++) {
        const base = e * MOUND_EDGE_STRIDE;
        _va.set(MOUND_EDGE_PAIRS[base],     MOUND_EDGE_PAIRS[base + 1], MOUND_EDGE_PAIRS[base + 2]);
        _vb.set(MOUND_EDGE_PAIRS[base + 3], MOUND_EDGE_PAIRS[base + 4], MOUND_EDGE_PAIRS[base + 5]);
        _va.applyMatrix4(m); _vb.applyMatrix4(m);
        edgeVerts.push(_va.x, _va.y, _va.z, _vb.x, _vb.y, _vb.z);
      }
      placed++;
    }
    inst.count = this.moundSlot;
    inst.instanceMatrix.needsUpdate = true;

    this.edgeBatcher?.addSegments(edgeVerts);
    this.shimmerTiles.push(tile);
    return [];
  }

  flush(scene: THREE.Scene): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    const edgesLS = this.edgeBatcher?.flush(scene);
    if (edgesLS) objects.push(edgesLS);
    if (this.shimmerTiles.length) {
      const shimmer = buildIcyShimmer(this.shimmerTiles, scene, [40, 21], [53, 79, 31]);
      if (shimmer) objects.push(shimmer);
    }
    this.edgeBatcher  = null;
    this.shimmerTiles = [];
    return objects;
  }
}

