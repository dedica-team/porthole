/**
 * Shared utilities, materials and helpers for all landmark renderers.
 */
import * as THREE from 'three';
import type { HexTile } from '@/types/hex';
import type { Landmark, LandmarkType, QualityLevel } from '@/types/landmark';
import { QUALITY_LEVEL_COLOR } from '@/types/landmark';
import { tileHeight, TRON_BLACK } from '../terrainUtils';

export { tileHeight, TRON_BLACK };

/** Greyish surface colour derived from the tile base (TRON_BLACK lightened + desaturated). */
export const LANDMARK_SURFACE_GREY = new THREE.Color(0x3a3d42);


// ── Interfaces ────────────────────────────────────────────────────────────────
export interface Adjacent {
  dir: THREE.Vector2;
  landmark: Landmark | null;
  hexTile: HexTile | null;
}

export interface LandmarkRenderer {

  readonly color: number;

  readonly requiresAdjacent: boolean;

  /**
   * @param tintColor  Surface tint colour (owner / group colour).
   * @param worstLevel Worst quality level for the status light (optional).
   * @param adjacent   Array of adjacent landmarks (optional) – used by some renderers to show connections or shared walls.
   */
  build(landmark: Landmark, elevation: number, tintColor: THREE.Color, adjacent?: Adjacent[], worstLevel?: QualityLevel): THREE.Group;
}

// ── colour helpers ────────────────────────────────────────────────────────────
/** Mix a base light-grey with a tint colour. t=0 → pure grey, t=1 → pure tint. */
export function tintGrey(tintHex: number, t = 0.28): THREE.Color {
  const base = new THREE.Color(0x606060);
  const tint = new THREE.Color(tintHex);
  return base.lerp(tint, t);
}

function buildGradientMap(): THREE.DataTexture {
  const data = new Uint8Array([128, 192, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
export const GRADIENT_MAP = buildGradientMap();

export function mat(bodyColor: THREE.Color, emissiveFraction = 0.12): THREE.MeshToonMaterial {
  const emissive = bodyColor.clone().multiplyScalar(emissiveFraction);
  const m = new THREE.MeshToonMaterial({
    color:       bodyColor,
    emissive:    emissive,
    gradientMap: GRADIENT_MAP,
  });
  (m as unknown as { flatShading: boolean }).flatShading = true;
  return m;
}

// Shared edge material – all outlines use the same TRON_BLACK colour.
const EDGE_LINE_MAT = new THREE.LineBasicMaterial({ color: TRON_BLACK });


/** Solid mesh using the shared toon material with the given tint colour. */
export function mesh(geo: THREE.BufferGeometry, bodyColor: THREE.Color): THREE.Mesh {
  return new THREE.Mesh(geo, mat(bodyColor));
}

// Cache EdgesGeometry by source geometry uuid – avoids recomputing edge pairs
// for repeated identical shapes (e.g. pillar BoxGeometry used in every Wall).
const _edgesGeoCache = new Map<string, THREE.EdgesGeometry>();

/** Edge outline for a mesh, always rendered in TRON_BLACK. */
export function edges(m: THREE.Mesh): THREE.LineSegments {
  const uuid = m.geometry.uuid;
  let eg = _edgesGeoCache.get(uuid);
  if (!eg) {
    eg = new THREE.EdgesGeometry(m.geometry);
    _edgesGeoCache.set(uuid, eg);
  }
  return new THREE.LineSegments(eg, EDGE_LINE_MAT);
}

// ── Glow material ─────────────────────────────────────────────────────────────
const GLOW_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv         = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLOW_FRAG = /* glsl */`
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2  vUv;

  void main() {
    float dist  = length(vUv - 0.5) * 2.0;
    float g     = pow(1.0 - clamp(dist, 0.0, 1.0), 0.9);
    float pulse = 0.7 + 0.3 * sin(uTime * 1.4);
    float a     = g * pulse * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/** Create a pulsing Fresnel-glow ShaderMaterial in the given tint colour.
 *  Shares the compiled GL program across all instances (same vertex/fragment
 *  source strings) but each call gets its own uniform set so colours/intensity
 *  are independent. */
let _glowTemplate: THREE.ShaderMaterial | null = null;

export function glowMat(tintColor: THREE.Color, intensity = 1.0): THREE.ShaderMaterial {
  if (!_glowTemplate) {
    _glowTemplate = new THREE.ShaderMaterial({
      uniforms: {
        uColor:     { value: new THREE.Color() },
        uTime:      { value: 0.0 },
        uIntensity: { value: 1.0 },
      },
      vertexShader:   GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
      side:           THREE.FrontSide,
    });
  }
  // .clone() reuses the same compiled GL program but gives independent uniforms.
  const m = _glowTemplate.clone();
  m.uniforms = THREE.UniformsUtils.clone(_glowTemplate.uniforms);
  m.uniforms['uColor'].value     = tintColor.clone();
  m.uniforms['uIntensity'].value = intensity;
  m.onBeforeRender = () => { m.uniforms['uTime'].value = performance.now() / 1000; };
  return m;
}

// ── namePlane texture cache ───────────────────────────────────────────────────
// Keyed by "<name>|<hexColor>" so the same name+colour combination reuses the
// same WebGL texture across landmark rebuilds (e.g. after every WS update).
const _namePlaneCache = new Map<string, THREE.CanvasTexture>();
// Shared plane geometry reused by every namePlane() call (same dimensions).
const _namePlaneGeo = new THREE.PlaneGeometry(2.8, 0.44);

/** Call this when the entire landmark layer is torn down (scene clear / unmount). */
export function clearNamePlaneCache(): void {
  _namePlaneCache.forEach((tex) => tex.dispose());
  _namePlaneCache.clear();
}

/**
 * Renders the landmark name slug as a flat decal lying on the tile surface,
 * centred on the south bottom edge of the tile (positive-Z side).
 * The mesh is rotated flat (rotation.x = -π/2) so the text faces up.
 *
 * @param name      Raw landmark name – converted to slug internally.
 * @param tintColor Owner / group colour used for the text and border.
 * @param zOffset   How far south (+ Z) to shift the label centre (default 0.55).
 */
export function namePlane(
  name: string,
  tintColor: THREE.Color,
  zOffset = 0.55,
): THREE.Mesh {

  const hex = '#' + tintColor.getHexString();
  const cacheKey = `${name}|${hex}`;

  let texture = _namePlaneCache.get(cacheKey);
  if (!texture) {
    const W = 512, H = 64;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = hex;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, W / 2, H / 2, W - 16);
    texture = new THREE.CanvasTexture(canvas);
    _namePlaneCache.set(cacheKey, texture);
  }

  const planeMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest:  false,   // always render above streets / connections
    side: THREE.DoubleSide,
  });
  const planeMesh = new THREE.Mesh(_namePlaneGeo, planeMat);
  planeMesh.name = 'namePlane';
  // Always render on top: disable depth test so geometry never occludes the
  // label, and use a high renderOrder so it draws after all connections and
  // terrain (including transparent Arrow/Street meshes).
  planeMesh.renderOrder = 999;
  planeMesh.rotation.x = -Math.PI / 2;
  planeMesh.position.set(0, 0.25, zOffset);
  return planeMesh;
}

export function group(...objects: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  const valid = objects.filter((o): o is THREE.Object3D => o instanceof THREE.Object3D);
  if (valid.length > 0) g.add(...valid);
  return g;
}

// ── Status light (quality metric indicator) ───────────────────────────────────
const STATUS_VERT = /* glsl */`
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STATUS_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uFreq;  // 0 = steady, >0 = blink frequency in Hz
  void main() {
    float brightness = uFreq > 0.0
      ? 0.5 + 0.5 * sin(uTime * 6.2832 * uFreq)
      : 1.0;
    gl_FragColor = vec4(uColor * brightness, brightness);
  }
`;

// ── Shared status-light geometries (allocated once, reused by every statusLight()) ──
const STATUS_RADIUS  = 0.03;
const _statusOuterGeo = new THREE.SphereGeometry(STATUS_RADIUS,        12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const _statusInnerGeo = new THREE.SphereGeometry(STATUS_RADIUS * 0.82, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);

/** Cache of pre-compiled ShaderMaterials keyed by "level" – one per QualityLevel.
 *  Each instance has its own uniforms so onBeforeRender can update uTime independently. */
const _statusMatCache = new Map<QualityLevel, THREE.ShaderMaterial>();

function _getStatusMat(level: QualityLevel): THREE.ShaderMaterial {
  const cached = _statusMatCache.get(level);
  if (cached) {
    // Clone shares the same compiled GL program but gets independent uniforms.
    const c = cached.clone();
    c.uniforms = THREE.UniformsUtils.clone(cached.uniforms);
    c.onBeforeRender = () => { c.uniforms['uTime'].value = performance.now() / 1000; };
    return c;
  }
  const colorHex = QUALITY_LEVEL_COLOR[level];
  const color = new THREE.Color(colorHex);
  const freq  = level === 'ERROR' ? 2.0 : level === 'WARNING' ? 1.0 : 0.0;
  const uniforms = {
    uTime:  { value: 0.0 },
    uColor: { value: color.clone() },
    uFreq:  { value: freq },
  };
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader:   STATUS_VERT,
    fragmentShader: STATUS_FRAG,
    transparent:    true,
    blending:       THREE.AdditiveBlending,
    depthWrite:     false,
  });
  m.onBeforeRender = () => { m.uniforms['uTime'].value = performance.now() / 1000; };
  _statusMatCache.set(level, m);
  return m;
}

/**
 * Creates a small blinking status sphere positioned at the top-right of a
 * landmark model. Colour and blink-rate depend on the worst quality level.
 *
 * NONE    → hidden (opacity 0)
 * OK      → steady green
 * WARNING → slow blink (1 Hz) amber
 * ERROR   → fast blink (2 Hz) red
 */
export function statusLight(level: QualityLevel, x = 0.35, y = 1.1, z = 0.0): THREE.Mesh {
  const colorHex = QUALITY_LEVEL_COLOR[level];
  const color    = new THREE.Color(colorHex);

  const outerMat  = _getStatusMat(level);
  const innerMat  = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.25) });
  const innerMesh = new THREE.Mesh(_statusInnerGeo, innerMat);
  const outerMesh = new THREE.Mesh(_statusOuterGeo, outerMat);
  outerMesh.position.set(x, y, z);
  outerMesh.visible = level !== 'NONE';
  outerMesh.add(innerMesh);

  return outerMesh;
}

// ── Registry ──────────────────────────────────────────────────────────────────
export type { LandmarkType };

