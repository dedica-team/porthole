/**
 * Public façade for connection renderers.
 * Each renderer lives in its own file under ./connections/.
 */
import * as THREE from 'three';
import type {Connection} from '@/types/connection';
import type {HexTile} from '@/types/hex';
import type {ConnectionRenderer} from './connections/ConnectionRenderer.ts';
import {PipeRenderer} from './connections/PipeRenderer.ts';
import {TelegraphRenderer} from './connections/TelegraphRenderer.ts';
import {StreetRenderer} from './connections/StreetRenderer.ts';
import {ArrowRenderer} from './connections/ArrowRenderer.ts';
import {hexToWorld} from '@/utils/hexUtils.ts';
import {tileHeight} from './terrainUtils';

export type { ConnectionRenderer } from './connections/ConnectionRenderer.ts';
export { PipeRenderer }      from './connections/PipeRenderer.ts';
export { TelegraphRenderer } from './connections/TelegraphRenderer.ts';
export { StreetRenderer }    from './connections/StreetRenderer.ts';
export { ArrowRenderer }     from './connections/ArrowRenderer.ts';
export { resolvePoints }     from './connections/resolvePoints.ts';

// ── Registry ──────────────────────────────────────────────────────────────────
const RENDERERS: Record<string, ConnectionRenderer> = {
  PIPE:      new PipeRenderer(),
  TELEGRAPH: new TelegraphRenderer(),
  STREET:    new StreetRenderer(),
  ARROW:     new ArrowRenderer(),
};

export function buildConnectionGroup(conn: Connection, tiles: HexTile[]): THREE.Group | null {
  const renderer = RENDERERS[conn.type ?? 'PIPE'];
  if (!renderer) {
    console.warn(`[connectionRenderers] Unknown connection type "${conn.type}", falling back to PIPE.`);
    return RENDERERS['PIPE'].build(conn, tiles);
  }
  return renderer.build(conn, tiles);
}

const HEX_SIZE       = 1;
const XRAY_LIFT      = 0.08;
const XRAY_SHAFT_HW  = 0.08;    // half-width of shaft ribbon (doubled from 0.055)
const XRAY_ARROW_HW  = 0.32;    // half-width at arrowhead base (doubled from 0.20)
const XRAY_ARROW_LEN = 0.32;    // length of arrowhead
const XRAY_TRIM      = 0.44;    // clearance from landmark cylinder edge
/**
 * Lateral offset perpendicular to the direction of travel (right-hand traffic rule).
 * Displaces lines so opposing or overlapping connections across the same hex tiles
 * render as separate parallel lanes rather than occluding each other.
 */
export const XRAY_LATERAL_OFFSET = 0.14;

/**
 * Builds an xray connection arrow following the original hex tile path:
 * ribbon shaft along the CatmullRom spline through conn.path,
 * ending in a triangular arrowhead at the target end.
 * Returns the group and its shared MeshBasicMaterial so the caller can
 * update the color when highlight state changes.
 */
export function buildXrayLine(
  conn: Connection,
  tiles: HexTile[],
): { group: THREE.Group; mat: THREE.MeshBasicMaterial } | null {
  if (!conn.path || conn.path.length < 2) return null;

  const tileMap = new Map<string, HexTile>();
  for (const t of tiles) tileMap.set(`${t.coordinate.q},${t.coordinate.r}`, t);

  const tileTopY = (q: number, r: number) => {
    const tile = tileMap.get(`${q},${r}`);
    return tileHeight(tile?.elevation ?? 0) + XRAY_LIFT;
  };

  const pathData = conn.path.map(({ q, r }) => {
    const { x: cx, z: cz } = hexToWorld(q, r, HEX_SIZE);
    return { cx, cz, topY: tileTopY(q, r) };
  });

  // Segment midpoint heights
  const segMidY: number[] = [];
  for (let i = 0; i < pathData.length - 1; i++) {
    segMidY.push(Math.max(pathData[i].topY, pathData[i + 1].topY));
  }

  const edgeHeightAt = (sx: number, sz: number, segIdx: number): number => {
    const a = pathData[segIdx], b = pathData[segIdx + 1];
    const da = Math.hypot(sx - a.cx, sz - a.cz);
    const db = Math.hypot(sx - b.cx, sz - b.cz);
    const total = da + db || 1;
    const ta = db / total, tb = da / total;
    const base = a.topY * ta + b.topY * tb;
    const tEdge = 1 - Math.abs(ta - tb);
    return base + (segMidY[segIdx] - base) * tEdge;
  };

  const rawPoints = pathData.map(({ cx, cz }) => new THREE.Vector3(cx, 0, cz));

  let curve: THREE.Curve<THREE.Vector3>;
  if (rawPoints.length === 2) {
    const dir = rawPoints[1].clone().sub(rawPoints[0]).normalize();
    const startPt = rawPoints[0].clone().add(dir.clone().multiplyScalar(XRAY_TRIM));
    const tipPt   = rawPoints[1].clone().sub(dir.clone().multiplyScalar(XRAY_TRIM));
    curve = new THREE.LineCurve3(startPt, tipPt);
  } else {
    const d0 = rawPoints[1].clone().sub(rawPoints[0]).normalize();
    const startPt = rawPoints[0].clone().add(d0.clone().multiplyScalar(XRAY_TRIM));

    const n = rawPoints.length - 1;
    const dN = rawPoints[n].clone().sub(rawPoints[n - 1]).normalize();
    const tipPt = rawPoints[n].clone().sub(dN.clone().multiplyScalar(XRAY_TRIM));

    const curvePoints = [startPt, ...rawPoints.slice(1, n), tipPt];
    curve = new THREE.CatmullRomCurve3(curvePoints);
  }

  const arcLength = curve.getLength();
  if (arcLength < 0.001) return null;

  const headFraction = Math.min(XRAY_ARROW_LEN / arcLength, 0.5);
  const headStart = 1 - headFraction;

  const SAMPLES = Math.max(conn.path.length * 6, 24);
  const sampledX  = new Float32Array(SAMPLES + 1);
  const sampledY  = new Float32Array(SAMPLES + 1);
  const sampledZ  = new Float32Array(SAMPLES + 1);
  const sampledTX = new Float32Array(SAMPLES + 1);
  const sampledTZ = new Float32Array(SAMPLES + 1);
  const _pt = new THREE.Vector3(), _tan = new THREE.Vector3();

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    curve.getPoint(t, _pt);
    curve.getTangent(t, _tan); _tan.normalize();
    const segIdx = Math.min(Math.floor(t * (conn.path.length - 1)), conn.path.length - 2);
    sampledX[i] = _pt.x;
    sampledY[i] = edgeHeightAt(_pt.x, _pt.z, segIdx);
    sampledZ[i] = _pt.z;
    sampledTX[i] = _tan.x;
    sampledTZ[i] = _tan.z;
  }

  const mat = new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide });
  const group = new THREE.Group();

  const shaftEndIdx = Math.max(1, Math.round(headStart * SAMPLES));

  // Shaft ribbon: samples 0 .. shaftEndIdx
  const shaftVerts: number[] = [];
  const shaftIdx: number[] = [];
  const perp = new THREE.Vector3();
  for (let i = 0; i <= shaftEndIdx; i++) {
    const px = sampledX[i], py = sampledY[i], pz = sampledZ[i];
    const stx = sampledTX[i], stz = sampledTZ[i];
    // Right-hand normal vector in the XZ plane: (-stz, 0, stx)
    const normX = -stz, normZ = stx;
    const cx = px + normX * XRAY_LATERAL_OFFSET;
    const cz = pz + normZ * XRAY_LATERAL_OFFSET;
    perp.set(normX, 0, normZ).multiplyScalar(XRAY_SHAFT_HW);
    shaftVerts.push(cx + perp.x, py, cz + perp.z);
    shaftVerts.push(cx - perp.x, py, cz - perp.z);
  }
  for (let i = 0; i < shaftEndIdx; i++) {
    const o = 2 * i;
    shaftIdx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
  }

  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.Float32BufferAttribute(shaftVerts, 3));
  shaftGeo.setIndex(shaftIdx);
  shaftGeo.computeVertexNormals();
  group.add(new THREE.Mesh(shaftGeo, mat));

  // Arrowhead triangle: base at shaftEndIdx, tip at SAMPLES (displaced by lateral offset)
  const bx = sampledX[shaftEndIdx], by = sampledY[shaftEndIdx], bz = sampledZ[shaftEndIdx];
  const ttx = sampledTX[shaftEndIdx], ttz = sampledTZ[shaftEndIdx];
  const bNormX = -ttz, bNormZ = ttx;
  const baseCX = bx + bNormX * XRAY_LATERAL_OFFSET;
  const baseCZ = bz + bNormZ * XRAY_LATERAL_OFFSET;
  perp.set(bNormX, 0, bNormZ).multiplyScalar(XRAY_ARROW_HW);

  const rawTipX = sampledX[SAMPLES], tipY = sampledY[SAMPLES], rawTipZ = sampledZ[SAMPLES];
  const endTX = sampledTX[SAMPLES], endTZ = sampledTZ[SAMPLES];
  const tipNormX = -endTZ, tipNormZ = endTX;
  const tipX = rawTipX + tipNormX * XRAY_LATERAL_OFFSET;
  const tipZ = rawTipZ + tipNormZ * XRAY_LATERAL_OFFSET;

  const arrowGeo = new THREE.BufferGeometry();
  arrowGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array([
    tipX,             tipY, tipZ,
    baseCX + perp.x,  by,   baseCZ + perp.z,
    baseCX - perp.x,  by,   baseCZ - perp.z,
  ]), 3));
  arrowGeo.setIndex([0, 1, 2]);
  arrowGeo.computeVertexNormals();
  group.add(new THREE.Mesh(arrowGeo, mat));

  return { group, mat };
}

