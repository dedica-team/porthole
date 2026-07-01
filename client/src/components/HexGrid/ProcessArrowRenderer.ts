/**
 * ProcessArrowRenderer
 *
 * Builds a THREE.Group containing one ribbon-arrow (+ optional title label) per
 * StageConnection in the active process stage.  The arrows hover above the
 * regular connection layer and respect the StageConnection direction:
 *   FORWARD      – arrowhead at the target end
 *   REVERSE      – path reversed, arrowhead at the origin end
 *   BIDIRECTIONAL– two half-opacity arrows on the same path
 */
import * as THREE from 'three';
import type { Connection } from '@/types/connection';
import type { HexTile } from '@/types/hex';
import type { StageConnection } from '@/types/process';
import {hexToWorld} from '@/utils/hexUtils.ts';
import {tileHeight} from './terrainUtils';

const HEX_SIZE      = 1;
const LIFT            = 0.10;
const SHAFT_WIDTH     = 0.18;
const TIP_HALF_WIDTH  = HEX_SIZE * 0.25;   // half of "half tile side edge" (0.5 / 2)
const HEAD_WORLD_LEN  = 0.50;
const TILE_INRADIUS   = HEX_SIZE * 0.87;
const PROCESS_COLOR   = 0x38bdf8;

export interface StageConnectionEntry {
  stageConn: StageConnection;
  connection: Connection;
}

// ── Shared material (one instance, opacity controlled per-arrow via clone) ───
function makeMat(opacity: number) {
  return new THREE.MeshBasicMaterial({
    color: PROCESS_COLOR,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
}

// ── Core ribbon builder ───────────────────────────────────────────────────────
function buildArrowRibbon(
  pathCoords: Array<{ q: number; r: number }>,
  tiles: HexTile[],
  opacity: number,
): { group: THREE.Group; midY: number } | null {
  if (pathCoords.length < 2) return null;

  const tileMap = new Map<string, HexTile>();
  for (const t of tiles) tileMap.set(`${t.coordinate.q},${t.coordinate.r}`, t);

  const tileTopY = (q: number, r: number) => {
    const tile = tileMap.get(`${q},${r}`);
    return tileHeight(tile?.elevation ?? 1) + LIFT;
  };

  const pathData = pathCoords.map(({ q, r }) => {
    const { x: cx, z: cz } = hexToWorld(q, r, HEX_SIZE);
    return { cx, cz, topY: tileTopY(q, r) };
  });

  // Segment midpoint heights (same logic as ArrowRenderer)
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

  // Spine: drop the landmark tiles at both ends, then trim inward by one inradius
  // so the arrow starts and ends at the tile edges adjacent to the landmark tiles.
  const rawPoints = pathData.map(({ cx, cz }) => new THREE.Vector3(cx, 0, cz));

  let curvePoints: THREE.Vector3[];
  if (rawPoints.length === 2) {
    // Direct neighbours: trim inward from both landmark tile centers
    const dir = rawPoints[1].clone().sub(rawPoints[0]).normalize();
    const startPt = rawPoints[0].clone().add(dir.clone().multiplyScalar(TILE_INRADIUS));
    const tipPt   = rawPoints[1].clone().sub(dir.clone().multiplyScalar(TILE_INRADIUS));
    curvePoints = [startPt, tipPt];
  } else {
    // General case: replace only the first and last control points with the
    // inradius-trimmed versions; keep ALL intermediate points for smooth curves.
    const d0 = rawPoints[1].clone().sub(rawPoints[0]).normalize();
    const startPt = rawPoints[0].clone().add(d0.clone().multiplyScalar(TILE_INRADIUS));

    const n = rawPoints.length - 1;
    const dN = rawPoints[n].clone().sub(rawPoints[n - 1]).normalize();
    const tipPt = rawPoints[n].clone().sub(dN.clone().multiplyScalar(TILE_INRADIUS));

    curvePoints = [startPt, ...rawPoints.slice(1, n), tipPt];
  }

  const curve = new THREE.CatmullRomCurve3(curvePoints);

  // Convert HEAD_WORLD_LEN to a t-fraction along the curve
  const arcLength = curve.getLength();
  const headFraction = arcLength > 0 ? Math.min(HEAD_WORLD_LEN / arcLength, 0.5) : 0.15;
  const headStart   = 1 - headFraction;

  const SAMPLES = Math.max(pathCoords.length * 6, 24);
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
    const segIdx = Math.min(Math.floor(t * (pathCoords.length - 1)), pathCoords.length - 2);
    sampledX[i] = _pt.x;
    sampledY[i] = edgeHeightAt(_pt.x, _pt.z, segIdx);
    sampledZ[i] = _pt.z;
    sampledTX[i] = _tan.x;
    sampledTZ[i] = _tan.z;
  }

  const midY = sampledY[Math.round(SAMPLES / 2)];
  const group = new THREE.Group();
  const mat   = makeMat(opacity);

  // shaftEndIdx: last sample index that belongs to the shaft (triangle starts after)
  const shaftEndIdx = Math.round(headStart * SAMPLES);

  // ── Shaft geometry: rows 0…shaftEndIdx-1 (exclusive of base) ────────────────
  const shaftVerts: number[] = [];
  const shaftIdx: number[] = [];
  const perp = new THREE.Vector3();

  for (let i = 0; i < shaftEndIdx; i++) {
    const px = sampledX[i], py = sampledY[i], pz = sampledZ[i];
    const stx = sampledTX[i], stz = sampledTZ[i];
    perp.set(-stz, 0, stx).normalize().multiplyScalar(SHAFT_WIDTH / 2);
    shaftVerts.push(px + perp.x, py, pz + perp.z);
    shaftVerts.push(px - perp.x, py, pz - perp.z);
  }
  for (let i = 0; i < shaftEndIdx - 1; i++) {
    const o = 2 * i;
    shaftIdx.push(o, o+2, o+1,  o+1, o+2, o+3);
  }
  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.Float32BufferAttribute(shaftVerts, 3));
  shaftGeo.setIndex(shaftIdx);
  shaftGeo.computeVertexNormals();
  group.add(new THREE.Mesh(shaftGeo, mat));

  // ── Triangle tip: base at shaftEndIdx, tip = base + tangent * HEAD_WORLD_LEN ─
  const bx = sampledX[shaftEndIdx], by = sampledY[shaftEndIdx], bz = sampledZ[shaftEndIdx];
  const ttx = sampledTX[shaftEndIdx], ttz = sampledTZ[shaftEndIdx];
  perp.set(-ttz, 0, ttx).normalize().multiplyScalar(TIP_HALF_WIDTH);
  const tipX = bx + ttx * HEAD_WORLD_LEN;
  const tipZ = bz + ttz * HEAD_WORLD_LEN;
  const tipVerts = [
    bx + perp.x, by, bz + perp.z,   // 0 base-left
    bx - perp.x, by, bz - perp.z,   // 1 base-right
    tipX,        by,  tipZ,           // 2 tip
  ];
  const tipGeo = new THREE.BufferGeometry();
  tipGeo.setAttribute('position', new THREE.Float32BufferAttribute(tipVerts, 3));
  tipGeo.setIndex([0, 2, 1]);
  tipGeo.computeVertexNormals();
  group.add(new THREE.Mesh(tipGeo, mat));

  return { group, midY };
}


// ── ProcessArrowRenderer ──────────────────────────────────────────────────────
export class ProcessArrowRenderer {
  private readonly group = new THREE.Group();
  private readonly childGeos: THREE.BufferGeometry[] = [];

  getGroup(): THREE.Group { return this.group; }

  update(entries: StageConnectionEntry[], tiles: HexTile[]): void {
    // Dispose previous children
    this.group.clear();
    this.childGeos.forEach((g) => g.dispose());
    this.childGeos.length = 0;

    for (const { stageConn, connection } of entries) {
      if (!connection.path || connection.path.length < 2) continue;

      const { direction } = stageConn;

      if (direction === 'BIDIRECTIONAL') {
        const fwd = buildArrowRibbon(connection.path, tiles, 0.36);
        const rev = buildArrowRibbon([...connection.path].reverse(), tiles, 0.36);
        if (fwd) { this.collectGeos(fwd.group); this.group.add(fwd.group); }
        if (rev) { this.collectGeos(rev.group); this.group.add(rev.group); }
      } else {
        const path = direction === 'REVERSE'
          ? [...connection.path].reverse()
          : connection.path;
        const arrow = buildArrowRibbon(path, tiles, 0.72);
        if (arrow) { this.collectGeos(arrow.group); this.group.add(arrow.group); }
      }

    }
  }

  private collectGeos(grp: THREE.Group) {
    grp.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        this.childGeos.push((child as THREE.Mesh).geometry);
      }
    });
  }

  dispose(): void {
    this.group.clear();
    this.childGeos.forEach((g) => g.dispose());
    this.childGeos.length = 0;
  }
}

