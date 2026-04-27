import * as THREE from 'three';
import type { Connection, HexTile } from '@/types/map.ts';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight, TRON_CYAN } from '../terrainUtils';
import type { ConnectionRenderer } from './ConnectionRenderer.ts';

const HEX_SIZE      = 1;
/** Width of the flat arrow shaft. */
const SHAFT_WIDTH   = 0.22;
/** Width of the arrowhead base (wider than the shaft). */
const HEAD_WIDTH    = 0.52;
/** Length of the arrowhead section (fraction of total curve length). */
const HEAD_FRACTION = 0.10;
/**
 * How far (in world units) the tip stops before the target tile centre.
 * A hex with HEX_SIZE=1 has an inradius of ~0.866, so 0.55 lands the tip
 * clearly inside the tile boundary but well away from the centre.
 */
const TIP_STOP_DIST = 0.55;
const LIFT          = 0.12;
const BRIDGE_LIFT   = 0.30;
const THICKNESS     = 0.03;   // thin, flat band
const HEX_CORNERS   = 6;
const CORNER_OFFSET = Math.PI / 6;

const ARROW_CYAN = 0x00e5ff;

interface PathTileData {
  cx: number; cz: number;
  topY: number;
  corners: Array<{ x: number; z: number }>;
}

export class ArrowRenderer implements ConnectionRenderer {
  /** Shared surface material – flat cyan. */
  private readonly bandMat = new THREE.MeshLambertMaterial({
    color: ARROW_CYAN,
    side: THREE.FrontSide,
    transparent: true,
    opacity: 0.85,
    depthTest:  true,
    depthWrite: true,
  });
  /** Bright cyan outline shared with other connection edges. */
  private readonly edgeMat = new THREE.LineBasicMaterial({
    color: TRON_CYAN,
    depthTest:  true,
    depthWrite: true,
  });

  build(conn: Connection, tiles: HexTile[]): THREE.Group | null {
    if (conn.path.length < 2) return null;

    const SAMPLES = Math.max(conn.path.length * 6, 24);

    const group = new THREE.Group();

    // ── O(1) tile lookup ──────────────────────────────────────────────────────
    const tileMap = new Map<string, HexTile>();
    for (const t of tiles) tileMap.set(`${t.coordinate.q},${t.coordinate.r}`, t);

    const tileTopY = (q: number, r: number): number => {
      const tile = tileMap.get(`${q},${r}`);
      const base = tileHeight(tile?.elevation ?? 1) + LIFT;
      return tile?.terrain === 'WATER' ? base + BRIDGE_LIFT : base;
    };

    // ── Path data ─────────────────────────────────────────────────────────────
    const pathData: PathTileData[] = conn.path.map(({ q, r }) => {
      const { x: cx, z: cz } = hexToWorld(q, r, HEX_SIZE);
      return {
        cx, cz,
        topY: tileTopY(q, r),
        corners: Array.from({ length: HEX_CORNERS }, (_, k) => {
          const angle = (k * Math.PI * 2) / HEX_CORNERS + CORNER_OFFSET;
          return {
            x: cx + HEX_SIZE * 0.95 * Math.cos(angle),
            z: cz + HEX_SIZE * 0.95 * Math.sin(angle),
          };
        }),
      };
    });

    // ── Pre-compute edge-height per segment (same as StreetRenderer) ──────────
    const segMidY: number[] = [];
    for (let i = 0; i < pathData.length - 1; i++) {
      const a = pathData[i], b = pathData[i + 1];
      let minDist = Infinity;
      let midY    = (a.topY + b.topY) / 2;
      for (const ca of a.corners) {
        for (const cb of b.corners) {
          const d = Math.hypot(ca.x - cb.x, ca.z - cb.z);
          if (d < minDist) { minDist = d; midY = Math.max(a.topY, b.topY); }
        }
      }
      segMidY.push(midY);
    }

    const edgeHeightAt = (sx: number, sz: number, segIdx: number): number => {
      const a     = pathData[segIdx];
      const b     = pathData[segIdx + 1];
      const da    = Math.hypot(sx - a.cx, sz - a.cz);
      const db    = Math.hypot(sx - b.cx, sz - b.cz);
      const total = da + db || 1;
      const ta    = db / total;
      const tb    = da / total;
      const base  = a.topY * ta + b.topY * tb;
      const tEdge = 1 - Math.abs(ta - tb);
      return base + (segMidY[segIdx] - base) * tEdge;
    };

    // ── Spine curve (stops before target tile centre) ─────────────────────────
    // Pull the last control point back along the final segment so the tip does
    // not reach the target tile centre.
    const rawPoints = pathData.map(({ cx, cz }) => new THREE.Vector3(cx, 0, cz));
    const last  = rawPoints[rawPoints.length - 1];
    const prev  = rawPoints[rawPoints.length - 2];
    const dir   = last.clone().sub(prev).normalize();
    const tipPt = last.clone().sub(dir.multiplyScalar(TIP_STOP_DIST));
    const curvePoints = [...rawPoints.slice(0, -1), tipPt];

    const curve = new THREE.CatmullRomCurve3(curvePoints);

    const sampledX  = new Float32Array(SAMPLES + 1);
    const sampledY  = new Float32Array(SAMPLES + 1);
    const sampledZ  = new Float32Array(SAMPLES + 1);
    const sampledTX = new Float32Array(SAMPLES + 1);
    const sampledTZ = new Float32Array(SAMPLES + 1);

    const _pt  = new THREE.Vector3();
    const _tan = new THREE.Vector3();
    for (let i = 0; i <= SAMPLES; i++) {
      const t      = i / SAMPLES;
      curve.getPoint(t, _pt);
      curve.getTangent(t, _tan); _tan.normalize();
      const segIdx    = Math.min(Math.floor(t * (conn.path.length - 1)), conn.path.length - 2);
      sampledX[i]  = _pt.x;
      sampledY[i]  = edgeHeightAt(_pt.x, _pt.z, segIdx);
      sampledZ[i]  = _pt.z;
      sampledTX[i] = _tan.x;
      sampledTZ[i] = _tan.z;
    }

    // ── Build ribbon vertices (shaft + tapered arrowhead) ─────────────────────
    // The last HEAD_FRACTION of the curve is the arrowhead that tapers to a point.
    const headStart = 1 - HEAD_FRACTION;   // parametric threshold

    const verts:     number[] = [];
    const indices:   number[] = [];
    const leftEdge:  number[] = [];
    const rightEdge: number[] = [];

    const perp = new THREE.Vector3();

    for (let i = 0; i <= SAMPLES; i++) {
      const t  = i / SAMPLES;
      const px = sampledX[i], py = sampledY[i], pz = sampledZ[i];
      const tx = sampledTX[i], tz = sampledTZ[i];

      // Half-width: shaft width until head region, then taper to 0 at tip.
      let halfW: number;
      if (t < headStart) {
        halfW = SHAFT_WIDTH / 2;
      } else {
        // At t = headStart the band widens to HEAD_WIDTH/2, then tapers to 0.
        const localT = (t - headStart) / HEAD_FRACTION;  // 0 → 1 inside head
        halfW = (HEAD_WIDTH / 2) * (1 - localT);
      }

      perp.set(-tz, 0, tx).normalize().multiplyScalar(halfW);
      const lx = px + perp.x, lz = pz + perp.z;
      const rx = px - perp.x, rz = pz - perp.z;

      verts.push(lx, py,             lz);  // 0 top-left
      verts.push(rx, py,             rz);  // 1 top-right
      verts.push(rx, py - THICKNESS, rz);  // 2 bottom-right
      verts.push(lx, py - THICKNESS, lz);  // 3 bottom-left
      leftEdge.push( lx, py, lz);
      rightEdge.push(rx, py, rz);
    }

    for (let i = 0; i < SAMPLES; i++) {
      const o = 4 * i;
      indices.push(o,   o+5, o+1,  o,   o+4, o+5);   // top
      indices.push(o+2, o+3, o+7,  o+2, o+7, o+6);   // bottom
      indices.push(o+3, o,   o+4,  o+3, o+4, o+7);   // left side
      indices.push(o+1, o+2, o+6,  o+1, o+6, o+5);   // right side
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, this.bandMat));

    // Outline edges along the shaft only (left + right silhouettes).
    for (const pts of [leftEdge, rightEdge]) {
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      group.add(new THREE.Line(edgeGeo, this.edgeMat));
    }

    return group;
  }
}

