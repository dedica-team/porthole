import * as THREE from 'three';
import type { HexTile } from '@/types/map.ts';
import { hexToWorld } from '@/utils/hexUtils.ts';
import {
  tileHeight, seed, lcgNext, LineBatcher, PointsBatcher, ROCK_EDGE_MAT,
  type TileColors, type TerrainRenderer,
} from '../terrainUtils';


const DEBRIS_GEO = new THREE.BoxGeometry(1, 1, 1);

// Pre-computed edge pairs of the unit box, transformed per-instance in the hot loop.
const DEBRIS_EDGE_PAIRS: Float32Array = (() => {
  const eg  = new THREE.EdgesGeometry(DEBRIS_GEO);
  const buf = (eg.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const out = new Float32Array(buf.length);
  out.set(buf);
  eg.dispose();
  return out;
})();
const DEBRIS_EDGE_STRIDE = 6;
const DEBRIS_EDGE_COUNT  = DEBRIS_EDGE_PAIRS.length / DEBRIS_EDGE_STRIDE;

// ── Debris shader ─────────────────────────────────────────────────────────────
// Per-instance attribute aPhase (0…1 random offset into the animation cycle).
// The cube slowly fades from scorched grey → radioactive green and back over a
// long randomised period.  A small sin-based vertex wobble adds atmosphere.

const DEBRIS_VERT = /* glsl */`
  attribute float aPhase;       // per-instance random phase [0, 1)
  varying   vec3  vColor;
  varying   float vGreen;       // 0=grey, 1=full green glow
  uniform   float uTime;

  // hash: maps a float seed to [0,1)
  float hash1(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    // Each cube has its own slow cycle: period = 18–35 s
    float period  = 18.0 + hash1(aPhase * 137.0) * 17.0;
    float t       = fract((uTime / period) + aPhase);   // 0…1 over one cycle
    // Only the middle third of the cycle is "green"; smooth in/out.
    float greenT  = smoothstep(0.25, 0.45, t) * (1.0 - smoothstep(0.55, 0.75, t));
    vGreen = greenT;

    // Grey → green colour blend
    // "grey" matches ROCK_MAT: TRON_BLACK (0x040810) + teal emissive (0x007888 * 0.06)
    vec3 grey  = vec3(0.016, 0.031, 0.063) + vec3(0.0, 0.028, 0.032);
    vec3 green = vec3(0.00, 1.00, 0.25);
    vColor = mix(grey, green, greenT);

    // Subtle vertex wobble – amplitude scales with how "green" the cube is
    float wobbleAmp = greenT * 0.06;
    vec3  wPos      = position;
    float wobble    = sin(uTime * 2.3 + aPhase * 31.4 + position.x * 8.0)
                    * sin(uTime * 1.7 + aPhase * 17.1 + position.y * 8.0);
    wPos += normal * wobble * wobbleAmp;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(wPos, 1.0);
    gl_Position     = projectionMatrix * mvPosition;
  }
`;

const DEBRIS_FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vGreen;

  void main() {
    // Additive glow boost when green
    vec3  col   = vColor * (1.0 + vGreen * 1.4);
    float alpha = 1.0;
    gl_FragColor = vec4(col, alpha);
  }
`;

const debrisUniforms = { uTime: { value: 0.0 } };

const DEBRIS_MAT = new THREE.ShaderMaterial({
  uniforms:       debrisUniforms,
  vertexShader:   DEBRIS_VERT,
  fragmentShader: DEBRIS_FRAG,
  // no transparency needed – opaque faces + additive glow in shader
});
DEBRIS_MAT.onBeforeRender = () => { debrisUniforms.uTime.value = performance.now() / 1000; };

const SCORCHED_TILE_COLORS: TileColors = {
  topColor:      0x040810,
  topEmissive:   new THREE.Color(0x3a0c00).multiplyScalar(0.05),
  topRoughness:  1.0,
  topMetalness:  0.0,
  sideColor:     0x040810,
  sideEmissive:  new THREE.Color(0x280800).multiplyScalar(0.03),
  sideRoughness: 1.0,
  sideMetalness: 0.0,
};

// ── Glow shader ───────────────────────────────────────────────────────────────
// Each point stores its own phase offset and cycle speed in the `aPhase` and
// `aSpeed` attributes. The vertex shader advances the phase using uTime and
// samples a small palette of lava colours via smooth step transitions.
// Additive blending is applied via the material flags below.

const VERT = /* glsl */`
  attribute float aPhase;
  attribute float aSpeed;
  varying vec3 vColor;

  // Lava palette
  vec3 lavaStop(int i) {
    if (i == 0) return vec3(0.55, 0.10, 0.00); // deep red
    if (i == 1) return vec3(0.80, 0.20, 0.00); // red
    if (i == 2) return vec3(1.00, 0.33, 0.00); // orange-red
               return vec3(1.00, 0.53, 0.00);  // orange
  }

  // Simple integer hash to pick a random palette index
  float hash1(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  uniform float uTime;
  uniform float uSize;

  void main() {
    // Total elapsed cycles for this point
    float elapsed = aPhase + uTime * aSpeed;
    float cycle   = floor(elapsed);      // which cycle we are in
    float t       = fract(elapsed);      // 0..1 progress within cycle

    // Pick two random stops for this cycle and the next
    int fromIdx = int(floor(hash1(cycle)          * 4.0));
    int toIdx   = int(floor(hash1(cycle + 137.0)  * 4.0));

    vec3 a = lavaStop(fromIdx);
    vec3 b = lavaStop(toIdx);
    vColor = mix(a, b, smoothstep(0.0, 1.0, t));

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (1.0 / -mvPosition.z);
    gl_Position  = projectionMatrix * mvPosition;
  }
`;

const FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    // Soft circular point
    vec2  uv   = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
    gl_FragColor = vec4(vColor * alpha, alpha * 0.9);
  }
`;

// Single shared material – uTime updated each frame by Three.js onBeforeRender
const glowUniforms = { uTime: { value: 0.0 }, uSize: { value: 25.0 } };

const GLOW_MAT = new THREE.ShaderMaterial({
  uniforms:       glowUniforms,
  vertexShader:   VERT,
  fragmentShader: FRAG,
  transparent:    true,
  blending:       THREE.AdditiveBlending,
  depthWrite:     false,
});

// Advance uTime via the renderer's built-in animation clock on every render
GLOW_MAT.onBeforeRender = (_renderer, _scene, _camera) => {
  glowUniforms.uTime.value = performance.now() / 1000;
};

// Max debris per tile: 6 + (v * 7) → max 12
const MAX_DEBRIS_PER_TILE = 13;

export class ScorchedRenderer implements TerrainRenderer {
  private debrisInst:  THREE.InstancedMesh | null = null;
  private debrisPhases: Float32Array | null = null;
  private debrisSlot = 0;
  private edgeBatcher: LineBatcher | null = null;
  private glowBatcher: PointsBatcher | null = null;

  tileColors(): TileColors { return SCORCHED_TILE_COLORS; }

  init(scene: THREE.Scene, maxTiles: number): THREE.Object3D[] {
    this.debrisSlot = 0;
    const capacity = maxTiles * MAX_DEBRIS_PER_TILE;
    this.debrisInst = new THREE.InstancedMesh(DEBRIS_GEO, DEBRIS_MAT, capacity);
    this.debrisInst.count = 0;
    this.debrisPhases = new Float32Array(capacity);
    this.debrisInst.geometry.setAttribute(
      'aPhase',
      new THREE.InstancedBufferAttribute(this.debrisPhases, 1),
    );
    scene.add(this.debrisInst);
    this.edgeBatcher = new LineBatcher(ROCK_EDGE_MAT);
    this.glowBatcher = new PointsBatcher(GLOW_MAT);
    return [this.debrisInst];
  }

  build(tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] {
    const inst   = this.debrisInst;
    const phases = this.debrisPhases;
    if (!inst || !phases) return [];

    // ── Cube debris ───────────────────────────────────────────────────────
    const R_D      = 0.75;
    const sqrt3_2D = Math.sqrt(3) / 2;

    const dummy  = new THREE.Object3D();
    const edgeVerts: number[] = [];
    const _va = new THREE.Vector3();
    const _vb = new THREE.Vector3();

    const { q, r } = tile.coordinate;
    const { x, z } = hexToWorld(q, r, 1);
    const top = tileHeight(tile.elevation);
    let rng = seed(tile, 67, 47, 23);

    let v: number;
    [rng, v] = lcgNext(rng);
    const count = 6 + Math.floor(v * 7);

    let placed = 0, attempts = 0;
    while (placed < count && attempts < count * 6) {
      attempts++;
      let lx: number, lz: number, ry: number, sc: number, ph: number;
      [rng, lx] = lcgNext(rng); lx = (lx * 2 - 1) * R_D;
      [rng, lz] = lcgNext(rng); lz = (lz * 2 - 1) * R_D;
      [rng, ry] = lcgNext(rng);
      [rng, sc] = lcgNext(rng);
      [rng, ph] = lcgNext(rng);

      if (Math.abs(lx) > R_D) continue;
      if (0.5 * Math.abs(lx) + sqrt3_2D * Math.abs(lz) > sqrt3_2D * R_D) continue;

      const size  = 0.02 + sc * 0.05;
      const halfH = size * 0.5;

      dummy.position.set(x + lx, top + halfH, z + lz);
      dummy.scale.set(size, size * (0.4 + sc * 0.6), size);
      dummy.rotation.set(0, ry * Math.PI * 2, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(this.debrisSlot, dummy.matrix);
      phases[this.debrisSlot] = ph;
      this.debrisSlot++;

      const m = dummy.matrix;
      for (let e = 0; e < DEBRIS_EDGE_COUNT; e++) {
        const base = e * DEBRIS_EDGE_STRIDE;
        _va.set(DEBRIS_EDGE_PAIRS[base],     DEBRIS_EDGE_PAIRS[base + 1], DEBRIS_EDGE_PAIRS[base + 2]);
        _vb.set(DEBRIS_EDGE_PAIRS[base + 3], DEBRIS_EDGE_PAIRS[base + 4], DEBRIS_EDGE_PAIRS[base + 5]);
        _va.applyMatrix4(m); _vb.applyMatrix4(m);
        edgeVerts.push(_va.x, _va.y, _va.z, _vb.x, _vb.y, _vb.z);
      }
      placed++;
    }

    inst.count = this.debrisSlot;
    inst.instanceMatrix.needsUpdate = true;
    (inst.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute).needsUpdate = true;

    this.edgeBatcher?.addSegments(edgeVerts);

    // ── Glow points ───────────────────────────────────────────────────────
    const R       = 0.78;
    const sqrt3_2 = Math.sqrt(3) / 2;
    const y = tileHeight(tile.elevation) + 0.004;

    let rng3 = seed(tile, 41, 79, 17) ^ 0xdead;
    let v3: number;
    [rng3, v3] = lcgNext(rng3);
    const ptTotal = 30 + Math.floor(v3 * 26);

    let ptPlaced = 0, ptAttempts = 0;
    while (ptPlaced < ptTotal && ptAttempts < ptTotal * 6) {
      ptAttempts++;
      let lx2: number, lz2: number, phase: number, speed: number;
      [rng3, lx2]   = lcgNext(rng3); lx2   = (lx2 * 2 - 1) * R;
      [rng3, lz2]   = lcgNext(rng3); lz2   = (lz2 * 2 - 1) * R;
      [rng3, phase] = lcgNext(rng3); phase = phase * 4.0;
      [rng3, speed] = lcgNext(rng3); speed = 0.3 + speed * 1.4;

      if (Math.abs(lx2) > R) continue;
      if (0.5 * Math.abs(lx2) + sqrt3_2 * Math.abs(lz2) > sqrt3_2 * R) continue;

      this.glowBatcher?.addPoint(x + lx2, y, z + lz2, { aPhase: phase, aSpeed: speed });
      ptPlaced++;
    }
    return [];
  }

  flush(scene: THREE.Scene): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    const edgesLS = this.edgeBatcher?.flush(scene);
    if (edgesLS) objects.push(edgesLS);
    const glow = this.glowBatcher?.flush(scene);
    if (glow) objects.push(glow);
    this.edgeBatcher = null;
    this.glowBatcher = null;
    return objects;
  }
}
