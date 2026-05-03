import * as THREE from 'three';
import type { Connection } from '@/types/connection';
import { TRON_CYAN } from '../terrainUtils';
import { LANDMARK_SURFACE_GREY } from '../landmarks/landmarkUtils.ts';
import type { ConnectionRenderer, TileLookup } from './ConnectionRenderer.ts';
import { resolvePoints } from './resolvePoints.ts';

// ── Shared geometry templates (module-level singletons) ───────────────────────
// Unit-length cylinder; each instance is scaled along Y to match segment length.
const PIPE_TEMPLATE = new THREE.CylinderGeometry(0.04, 0.04, 1, 6, 1);
const RING_TEMPLATE = new THREE.TorusGeometry(0.04, 0.018, 6, 10);

export class PipeRenderer implements ConnectionRenderer {
  // Shared materials – created once per renderer instance.
  private readonly pipeMat = new THREE.MeshLambertMaterial({
    color: LANDMARK_SURFACE_GREY,
    emissive: new THREE.Color(LANDMARK_SURFACE_GREY).multiplyScalar(0.5),
  });
  private readonly ringMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(TRON_CYAN).multiplyScalar(0.8),
  });

  build(conn: Connection, tileLookup: TileLookup): THREE.Group | null {
    const points = resolvePoints(conn, tileLookup);
    if (points.length < 2) return null;

    const segCount  = points.length - 1;
    const ringCount = points.length - 1; // one collar per join (skip first point)

    const group       = new THREE.Group();
    const pipeInst    = new THREE.InstancedMesh(PIPE_TEMPLATE, this.pipeMat, segCount);
    const ringInst    = new THREE.InstancedMesh(RING_TEMPLATE, this.ringMat, ringCount);
    const dummy       = new THREE.Object3D();
    const up          = new THREE.Vector3(0, 1, 0);

    // ── Pipe segments ─────────────────────────────────────────────────────────
    for (let i = 0; i < segCount; i++) {
      const a   = points[i];
      const b   = points[i + 1];
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      dummy.position.copy(a).lerp(b, 0.5);
      dummy.quaternion.setFromUnitVectors(up, dir.normalize());
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      pipeInst.setMatrixAt(i, dummy.matrix);
    }
    pipeInst.instanceMatrix.needsUpdate = true;
    group.add(pipeInst);

    // ── Collar rings at each join ─────────────────────────────────────────────
    const fwd = new THREE.Vector3(0, 0, 1);
    for (let i = 1; i < points.length; i++) {
      const incoming = new THREE.Vector3().subVectors(points[i], points[i - 1]).normalize();
      const outgoing = i < points.length - 1
        ? new THREE.Vector3().subVectors(points[i + 1], points[i]).normalize()
        : incoming.clone();
      const bisector = incoming.clone().add(outgoing).normalize();
      dummy.position.copy(points[i]);
      dummy.quaternion.setFromUnitVectors(fwd, bisector);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      ringInst.setMatrixAt(i - 1, dummy.matrix);
    }
    ringInst.instanceMatrix.needsUpdate = true;
    group.add(ringInst);

    return group;
  }
}
