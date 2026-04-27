import * as THREE from 'three';
import type { Landmark, QualityLevel } from '@/types/map.ts';
import { mesh, namePlane, group, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY, TRON_BLACK } from './landmarkUtils';

const PIPE_R = 0.018;

/** Edge outline with position/rotation synced from its mesh. */
function syncedEdges(m: THREE.Mesh, threshold = 15): THREE.LineSegments {
  const ls = new THREE.LineSegments(
    new THREE.EdgesGeometry(m.geometry, threshold),
    new THREE.LineBasicMaterial({ color: TRON_BLACK }),
  );
  ls.position.copy(m.position);
  ls.rotation.copy(m.rotation);
  return ls;
}

/** Create a mesh and immediately disable flatShading (avoids dark banding on curved surfaces). */
function roundMesh(geo: THREE.BufferGeometry, color: THREE.Color): THREE.Mesh {
  const m = mesh(geo, color);
  (m.material as THREE.MeshStandardMaterial).flatShading = false;
  m.geometry.computeVertexNormals();
  return m;
}

/**
 * Submarine – only the conning tower (sail) and periscope are visible
 * above the waterline; the hull is barely hinted as a low dark silhouette.
 */
export class SubmarineRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0x224466;

  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    const g = group();

    // ── conning tower (cuboid) ────────────────────────────────────────────
    const tower = mesh(new THREE.BoxGeometry(0.15, 0.22, 0.35), LANDMARK_SURFACE_GREY);
    tower.position.set(0.0, 0.05 + 0.11, 0.03);
    tower.rotation.y = Math.PI / 2;
    g.add(tower, syncedEdges(tower));

    // ── periscope ─────────────────────────────────────────────────────────
    const SHAFT_H = 0.28;
    const shaftBotY = 0.16;
    const shaftTopY = shaftBotY + SHAFT_H;

    const shaft = roundMesh(new THREE.CylinderGeometry(PIPE_R, PIPE_R, SHAFT_H, 12), LANDMARK_SURFACE_GREY);
    shaft.position.set(0.08, shaftBotY + SHAFT_H / 2, 0.04);
    g.add(shaft);

    const BEND_R = 0.06;
    const bend = roundMesh(new THREE.TorusGeometry(BEND_R, PIPE_R, 8, 16, Math.PI / 2), LANDMARK_SURFACE_GREY);
    (bend.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
    bend.rotation.y = Math.PI / 2;
    bend.position.set(0.08, shaftTopY, 0.04 + BEND_R);
    g.add(bend);

    // ── antenna ───────────────────────────────────────────────────────────
    const antenna = roundMesh(new THREE.CylinderGeometry(0.006, 0.009, 0.30, 8), tintColor);
    antenna.position.set(-0.08, 0.16 + 0.15, -0.02);
    g.add(antenna);

    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, -0.10, 0.27, 0));
    return g;
  }
}
