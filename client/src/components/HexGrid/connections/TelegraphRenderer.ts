import * as THREE from 'three';
import type { Connection, HexTile } from '@/types/map.ts';
import { TRON_CYAN } from '../terrainUtils';
import type { ConnectionRenderer } from './ConnectionRenderer.ts';
import { resolvePoints } from './resolvePoints.ts';

const POLE_HEIGHT = 0.55;
const WIRE_Y      = POLE_HEIGHT + 0.05;
const SAG         = 0.08;
const SAG_STEPS   = 8;

// ── Shared geometry templates ─────────────────────────────────────────────────
const SHAFT_GEO = new THREE.CylinderGeometry(0.018, 0.022, POLE_HEIGHT, 6);
const INSUL_GEO = new THREE.CylinderGeometry(0.016, 0.016, 0.05, 5);

export class TelegraphRenderer implements ConnectionRenderer {
  // Shared materials – created once per renderer instance.
  private readonly poleMat  = new THREE.MeshToonMaterial({ color: 0x5a6a7a });
  private readonly insulMat = new THREE.MeshToonMaterial({
    color:    new THREE.Color(TRON_CYAN),
    emissive: new THREE.Color(TRON_CYAN).multiplyScalar(0.35),
  });
  private readonly wireMat  = new THREE.LineBasicMaterial({ color: TRON_CYAN });

  build(conn: Connection, tiles: HexTile[]): THREE.Group | null {
    const points = resolvePoints(conn, tiles);
    if (points.length < 2) return null;

    const group      = new THREE.Group();
    const shaftInst  = new THREE.InstancedMesh(SHAFT_GEO, this.poleMat,  points.length);
    const insulInst  = new THREE.InstancedMesh(INSUL_GEO, this.insulMat, points.length);
    const dummy      = new THREE.Object3D();

    // ── One pole + insulator per path point ───────────────────────────────────
    points.forEach((p: THREE.Vector3, i: number) => {
      dummy.position.set(p.x, p.y + POLE_HEIGHT / 2, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      shaftInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, p.y + POLE_HEIGHT + 0.025, p.z);
      dummy.updateMatrix();
      insulInst.setMatrixAt(i, dummy.matrix);
    });
    shaftInst.instanceMatrix.needsUpdate = true;
    insulInst.instanceMatrix.needsUpdate = true;
    group.add(shaftInst, insulInst);

    // ── Wire with parabolic sag ───────────────────────────────────────────────
    const wireVerts: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const ayW = a.y + WIRE_Y;
      const byW = b.y + WIRE_Y;
      for (let s = 0; s < SAG_STEPS; s++) {
        const t0 = s / SAG_STEPS;
        const t1 = (s + 1) / SAG_STEPS;
        wireVerts.push(
          a.x + (b.x - a.x) * t0, ayW + (byW - ayW) * t0 - SAG * 4 * t0 * (1 - t0), a.z + (b.z - a.z) * t0,
          a.x + (b.x - a.x) * t1, ayW + (byW - ayW) * t1 - SAG * 4 * t1 * (1 - t1), a.z + (b.z - a.z) * t1,
        );
      }
    }
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wireVerts, 3));
    group.add(new THREE.LineSegments(wireGeo, this.wireMat));

    return group;
  }
}
