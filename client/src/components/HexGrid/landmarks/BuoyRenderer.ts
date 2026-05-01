import * as THREE from 'three';
import type { Landmark, QualityLevel } from '@/types/landmark';
import { mesh, edges, namePlane, group, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY } from './landmarkUtils';

export class BuoyRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0xff4422;

  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    const g = group();

    // ── anchor chain ──────────────────────────────────────────────────────
    const chain = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4), LANDMARK_SURFACE_GREY);
    chain.position.set(0, -0.04, 0);
    g.add(chain);

    // ── lower float body ──────────────────────────────────────────────────
    const lowerGeo = new THREE.SphereGeometry(0.18, 10, 8);
    lowerGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 0.62, 1));
    const lower = mesh(lowerGeo, LANDMARK_SURFACE_GREY);
    lower.position.y = 0.12;
    const lowerEdges = edges(lower); lowerEdges.position.y = 0.12;
    g.add(lower, lowerEdges);

    // ── upper float body ──────────────────────────────────────────────────
    const upperGeo = new THREE.SphereGeometry(0.16, 10, 8);
    upperGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 0.55, 1));
    const upper = mesh(upperGeo, LANDMARK_SURFACE_GREY);
    upper.position.y = 0.30;
    const upperEdges = edges(upper); upperEdges.position.y = 0.30;
    g.add(upper, upperEdges);

    // ── horizontal band stripe ────────────────────────────────────────────
    const band = mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.04, 10), tintColor);
    band.position.y = 0.21;
    g.add(band);

    // ── vertical mast ─────────────────────────────────────────────────────
    const mast = mesh(new THREE.CylinderGeometry(0.016, 0.020, 0.44, 5), LANDMARK_SURFACE_GREY);
    mast.position.y = 0.60;
    const mastEdges = edges(mast); mastEdges.position.y = 0.60;
    g.add(mast, mastEdges);

    // ── top light / flasher sphere ────────────────────────────────────────
    const lightGeo = new THREE.SphereGeometry(0.05, 8, 6);
    const lightMesh = mesh(lightGeo, LANDMARK_SURFACE_GREY);
    lightMesh.position.y = 0.87;
    g.add(lightMesh);

    // ── cross-bar ─────────────────────────────────────────────────────────
    const bar = mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.22, 4), LANDMARK_SURFACE_GREY);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 0.76;
    g.add(bar);

    // ── scale the whole buoy down ─────────────────────────────────────────
    g.scale.setScalar(0.8);

    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, 0.92, 0));
    return g;
  }
}
