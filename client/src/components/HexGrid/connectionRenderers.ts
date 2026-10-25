/**
 * Public façade for connection renderers.
 * Each renderer lives in its own file under ./connections/.
 */
import * as THREE from 'three';
import type { Connection } from '@/types/connection';
import type { HexTile } from '@/types/hex';
import type { ConnectionRenderer }  from './connections/ConnectionRenderer.ts';
import { PipeRenderer }             from './connections/PipeRenderer.ts';
import { TelegraphRenderer }        from './connections/TelegraphRenderer.ts';
import { StreetRenderer }           from './connections/StreetRenderer.ts';
import { ArrowRenderer }            from './connections/ArrowRenderer.ts';
import { hexToWorld }               from '@/utils/hexUtils.ts';
import { tileHeight }               from './terrainUtils';

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
const XRAY_LIFT      = 0.04;
const XRAY_SHAFT_HW  = 0.11;    // half-width of shaft ribbon (doubled from 0.055)
const XRAY_ARROW_HW  = 0.40;    // half-width at arrowhead base (doubled from 0.20)
const XRAY_ARROW_LEN = 0.30;    // length of arrowhead
const XRAY_TRIM      = 0.44;    // clearance from landmark cylinder edge

/**
 * Builds a straight-line xray connection: thin shaft from origin to target
 * plus a small triangular arrowhead at the target end.
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

  const getY = (q: number, r: number) =>
    tileHeight(tileMap.get(`${q},${r}`)?.elevation ?? 0) + XRAY_LIFT;

  const first = conn.path[0];
  const last  = conn.path[conn.path.length - 1];

  const { x: ax, z: az } = hexToWorld(first.q, first.r, HEX_SIZE);
  const { x: bx, z: bz } = hexToWorld(last.q,  last.r,  HEX_SIZE);
  const y = (getY(first.q, first.r) + getY(last.q, last.r)) * 0.5;

  const dx = bx - ax, dz = bz - az;
  const d  = Math.hypot(dx, dz);
  if (d < 0.001) return null;
  const tx = dx / d, tz = dz / d;
  const px = -tz,    pz =  tx;

  const totalTrim = XRAY_TRIM * 2 + XRAY_ARROW_LEN;
  if (d < totalTrim + 0.01) return null;

  // Shaft: from trimmed origin to arrowhead base
  const s0x = ax + tx * XRAY_TRIM,              s0z = az + tz * XRAY_TRIM;
  const s1x = bx - tx * (XRAY_TRIM + XRAY_ARROW_LEN), s1z = bz - tz * (XRAY_TRIM + XRAY_ARROW_LEN);
  // Arrowhead tip: trimmed inward from target
  const tipX = bx - tx * XRAY_TRIM, tipZ = bz - tz * XRAY_TRIM;

  const mat = new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide });
  const group = new THREE.Group();

  // Shaft ribbon
  const hw = XRAY_SHAFT_HW;
  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array([
    s0x + px * hw, y, s0z + pz * hw,
    s0x - px * hw, y, s0z - pz * hw,
    s1x + px * hw, y, s1z + pz * hw,
    s1x - px * hw, y, s1z - pz * hw,
  ]), 3));
  shaftGeo.setIndex([0, 2, 1, 1, 2, 3]);
  group.add(new THREE.Mesh(shaftGeo, mat));

  // Arrowhead triangle
  const aw = XRAY_ARROW_HW;
  const arrowGeo = new THREE.BufferGeometry();
  arrowGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array([
    tipX,          y, tipZ,
    s1x + px * aw, y, s1z + pz * aw,
    s1x - px * aw, y, s1z - pz * aw,
  ]), 3));
  arrowGeo.setIndex([0, 1, 2]);
  group.add(new THREE.Mesh(arrowGeo, mat));

  return { group, mat };
}

