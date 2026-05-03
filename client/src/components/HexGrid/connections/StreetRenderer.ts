import * as THREE from 'three';
import type { Connection } from '@/types/connection';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight, TRON_CYAN } from '../terrainUtils';
import { LANDMARK_SURFACE_GREY } from '../landmarks/landmarkUtils.ts';
import type { ConnectionRenderer, TileLookup } from './ConnectionRenderer.ts';

const HEX_SIZE      = 1;
const STREET_WIDTH  = 0.30;
const LIFT          = 0.10;
const BRIDGE_LIFT   = 0.30;
const THICKNESS     = 0.10;
const HEX_CORNERS   = 6;
const CORNER_OFFSET = Math.PI / 6;

interface PathTileData {
  cx: number; cz: number;
  topY: number;
  corners: Array<{ x: number; z: number }>;
}

export class StreetRenderer implements ConnectionRenderer {
  // Shared materials – created once per renderer instance.
  private readonly streetMat = new THREE.MeshLambertMaterial({
    color: LANDMARK_SURFACE_GREY,
    side:  THREE.FrontSide,
    depthTest:  true,
    depthWrite: true,
  });
  private readonly edgeMat   = new THREE.LineBasicMaterial({
    color: TRON_CYAN,
    depthTest:  true,
    depthWrite: true,
  });
  private readonly pillarMat = new THREE.MeshToonMaterial({ color: 0x4a5a6a });

  build(conn: Connection, tileLookup: TileLookup): THREE.Group | null {
    if (conn.path.length < 2) return null;

    const SAMPLES = Math.max(conn.path.length * 6, 24);

    const group = new THREE.Group();

    const tileTopY = (q: number, r: number): number => {
      const tile = tileLookup.get(`${q},${r}`);
      const base = tileHeight(tile?.elevation ?? 1) + LIFT;
      return tile?.terrain === 'WATER' ? base + BRIDGE_LIFT : base;
    };

    // ── Path data (compute once, reuse for spine + edgeHeight) ───────────────
    const pathData: PathTileData[] = conn.path.map(({ q, r }) => {
      const { x: cx, z: cz } = hexToWorld(q, r, HEX_SIZE);
      return {
        cx, cz,
        topY: tileTopY(q, r),
        corners: Array.from({ length: HEX_CORNERS }, (_, k) => {
          const angle = (k * Math.PI * 2) / HEX_CORNERS + CORNER_OFFSET;
          return { x: cx + HEX_SIZE * 0.95 * Math.cos(angle), z: cz + HEX_SIZE * 0.95 * Math.sin(angle) };
        }),
      };
    });

    // ── Pre-compute shared-mid-Y per segment (corners loop runs once, not per sample) ──
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

    // ── Spine from pre-computed pathData centres ──────────────────────────────
    const curve = new THREE.CatmullRomCurve3(
      pathData.map(({ cx, cz }) => new THREE.Vector3(cx, 0, cz)),
    );

    // Flat arrays avoid per-sample heap allocation
    const sampledX = new Float32Array(SAMPLES + 1);
    const sampledY = new Float32Array(SAMPLES + 1);
    const sampledZ = new Float32Array(SAMPLES + 1);
    const sampledTX = new Float32Array(SAMPLES + 1);
    const sampledTZ = new Float32Array(SAMPLES + 1);

    const _pt  = new THREE.Vector3();
    const _tan = new THREE.Vector3();
    for (let i = 0; i <= SAMPLES; i++) {
      const t      = i / SAMPLES;
      curve.getPoint(t, _pt);
      curve.getTangent(t, _tan); _tan.normalize();
      const segIdx = Math.min(Math.floor(t * (conn.path.length - 1)), conn.path.length - 2);
      sampledX[i] = _pt.x;
      sampledY[i] = edgeHeightAt(_pt.x, _pt.z, segIdx);
      sampledZ[i] = _pt.z;
      sampledTX[i] = _tan.x;
      sampledTZ[i] = _tan.z;
    }

    // ── Thick ribbon ──────────────────────────────────────────────────────────
    const verts:     number[] = [];
    const indices:   number[] = [];
    const leftEdge:  number[] = [];
    const rightEdge: number[] = [];

    const perp = new THREE.Vector3(); // reused each iteration
    for (let i = 0; i <= SAMPLES; i++) {
      const px = sampledX[i], py = sampledY[i], pz = sampledZ[i];
      const tx = sampledTX[i], tz = sampledTZ[i];
      perp.set(-tz, 0, tx).normalize().multiplyScalar(STREET_WIDTH / 2);
      const lx = px + perp.x, lz = pz + perp.z;
      const rx = px - perp.x, rz = pz - perp.z;
      verts.push(lx, py,             lz);
      verts.push(rx, py,             rz);
      verts.push(rx, py - THICKNESS, rz);
      verts.push(lx, py - THICKNESS, lz);
      leftEdge.push( lx, py, lz);
      rightEdge.push(rx, py, rz);
    }
    for (let i = 0; i < SAMPLES; i++) {
      const o = 4 * i;
      indices.push(o,   o+5, o+1,  o,   o+4, o+5);   // top    (normal up)
      indices.push(o+2, o+3, o+7,  o+2, o+7, o+6);   // bottom
      indices.push(o+3, o,   o+4,  o+3, o+4, o+7);   // left
      indices.push(o+1, o+2, o+6,  o+1, o+6, o+5);   // right
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, this.streetMat));

    for (const pts of [leftEdge, rightEdge]) {
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      group.add(new THREE.Line(edgeGeo, this.edgeMat));
    }

    // ── Bridge pillars under water tiles ─────────────────────────────────────
    conn.path.forEach(({ q, r }) => {
      const tile = tileLookup.get(`${q},${r}`);
      if (tile?.terrain !== 'WATER') return;
      const { x: px, z: pz } = hexToWorld(q, r, HEX_SIZE);
      const waterSurface = tileHeight(tile.elevation);
      const pillarH      = LIFT + BRIDGE_LIFT;
      const pillarGeo    = new THREE.CylinderGeometry(0.06, 0.08, pillarH, 6);
      const pillar       = new THREE.Mesh(pillarGeo, this.pillarMat);
      pillar.position.set(px, waterSurface + pillarH / 2, pz);
      group.add(pillar);
    });

    return group;
  }
}

