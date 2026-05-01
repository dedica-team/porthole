import * as THREE from 'three';
import type { Landmark, QualityLevel } from '@/types/landmark';
import { mesh, namePlane, group, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY, TRON_BLACK } from './landmarkUtils';

/**
 * Rounded rowboat hull via LatheGeometry.
 * The profile is a half-ellipse cross-section rotated 180° around Y,
 * then stretched along X to give the elongated boat shape.
 */
function rowboatHullGeo(): THREE.BufferGeometry {
  // Profile in the XY plane: from keel (0,0) curving out to gunwale (0.18, 0.15)
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.00,  0.00),  // keel centre
    new THREE.Vector2(0.08,  0.03),
    new THREE.Vector2(0.14,  0.07),
    new THREE.Vector2(0.17,  0.11),
    new THREE.Vector2(0.18,  0.15),  // gunwale rim
  ];
  // LatheGeometry rotates the profile 360° to give a full oval cross-section
  const geo = new THREE.LatheGeometry(profile, 10, 0, Math.PI * 2);
  // Squash Z → make it oval (boat-width) and stretch X → boat length
  geo.applyMatrix4(new THREE.Matrix4().makeScale(3.6, 1.0, 1.0));
  geo.computeVertexNormals();
  return geo;
}

/** Edge outline with a higher crease threshold so only real silhouette edges show. */
function crispEdges(m: THREE.Mesh, threshold = 20): THREE.LineSegments {
  const eg = new THREE.EdgesGeometry(m.geometry, threshold);
  return new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: TRON_BLACK }));
}

export class SailboatRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0x88ccff;

  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    const g = group();

    // ── rowboat hull ──────────────────────────────────────────────────────
    const hull = mesh(rowboatHullGeo(), LANDMARK_SURFACE_GREY);
    (hull.material as THREE.Material).side = THREE.DoubleSide;
    const hullE = crispEdges(hull);
    g.add(hull, hullE);

    // ── mast (short, stepped slightly forward of centre) ──────────────────
    const mast = mesh(new THREE.CylinderGeometry(0.020, 0.024, 0.65, 12), LANDMARK_SURFACE_GREY);
    mast.position.set(0.08, 0.42, 0);
    g.add(mast);

    // ── triangular lateen sail ────────────────────────────────────────────
    // Thin ConeGeometry scaled to a flat triangular sail shape
    const sailGeo = new THREE.ConeGeometry(0.01, 0.44, 3);
    sailGeo.applyMatrix4(new THREE.Matrix4().makeScale(14, 1, 1));
    const sail = mesh(sailGeo, tintColor);
    (sail.material as THREE.Material).side = THREE.DoubleSide;
    sail.position.set(0.02, 0.15 + 0.28, 0.08);
    sail.rotation.set(0, Math.PI / 6, 0);
    g.add(sail);

    g.scale.set(0.5, 0.5, 0.5);

    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0.08, 0.75, 0));
    return g;
  }
}
