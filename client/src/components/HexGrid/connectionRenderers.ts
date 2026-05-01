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
import { resolvePoints }            from './connections/resolvePoints.ts';

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

/** Dim grey line material shared by all process-mode simple connections. */
const PROCESS_LINE_MAT = new THREE.MeshBasicMaterial({
  color: 0x555555,
  transparent: true,
  opacity: 0.7,
  side: THREE.DoubleSide,
  depthTest: true,
  depthWrite: true,
});

const RIBBON_HALF = 0.09;  // half of SHAFT_WIDTH (0.18) from ProcessArrowRenderer

/**
 * Builds a flat ribbon mesh following the connection path.
 * Width matches the process arrow shaft so the two look consistent.
 * Used in process mode instead of the full renderer to keep the map clean.
 */
export function buildSimpleConnectionLine(conn: Connection, tiles: HexTile[]): THREE.Mesh | null {
  const pts = resolvePoints(conn, tiles);
  if (pts.length < 2) return null;

  const positions: number[] = [];
  const indices:   number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();

  for (let i = 0; i < pts.length; i++) {
    // tangent direction
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
    side.crossVectors(tangent, up).normalize().multiplyScalar(RIBBON_HALF);

    const p = pts[i];
    positions.push(p.x - side.x, p.y - side.y, p.z - side.z);  // left
    positions.push(p.x + side.x, p.y + side.y, p.z + side.z);  // right
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 1, base + 3, base + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, PROCESS_LINE_MAT);
  return mesh;
}

