/**
 * Tall radio-tower antenna with cross-arms, guy-wires and a blinking beacon.
 *
 * Structure:
 *  - concrete base
 *  - tapered mast (4-sided, narrowing toward top)
 *  - three sets of cross-arms at decreasing heights
 *  - guy-wire diagonals (thin cylinders)
 *  - beacon dome at apex
 */
import * as THREE from 'three';
import type { Landmark } from '@/types/map.ts';
import type { QualityLevel } from '@/types/map.ts';
import { mesh, edges, namePlane, group, glowMat, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY } from './landmarkUtils';

export class AntennaRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0xc0c8d0;

  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    // ── base ─────────────────────────────────────────────────────────────────
    const base = mesh(new THREE.BoxGeometry(0.22, 0.04, 0.22), tintColor);
    base.position.y = 0.04;


    // ── horizontal bars between guy-wire anchor points at several heights ─────
    // Guys go from base corners (±0.10, 0, ±0.10) to apex (0, topY, 0).
    // At height y, the guy is at x = 0.10 * (1 - y/topY), same for z.
    const topY = 1.38;
    const baseOffset = 0.10;
    const barHeights = [0.34, 0.68, 1.02];
    const barMeshes: THREE.Mesh[] = [];
    barHeights.forEach(y => {
      const spread = baseOffset * (1 - y / topY); // guy X/Z position at this height
      const barLen = spread * 2;

      // two bars along X axis (at +z and -z guy positions)
      [spread, -spread].forEach(z => {
        const b = mesh(new THREE.CylinderGeometry(0.008, 0.008, barLen, 4), LANDMARK_SURFACE_GREY);
        b.rotation.z = Math.PI / 2;
        b.position.set(0, y, z);
        barMeshes.push(b);
      });

      // two bars along Z axis (at +x and -x guy positions)
      [spread, -spread].forEach(x => {
        const b = mesh(new THREE.CylinderGeometry(0.008, 0.008, barLen, 4), LANDMARK_SURFACE_GREY);
        b.rotation.x = Math.PI / 2;
        b.position.set(x, y, 0);
        barMeshes.push(b);
      });
    });

    // ── diagonal guy-wires from base corners to apex ──────────────────────────
    const guyPositions: [number, number, number][] = [
      [ 0.10, 0,  0.10], [-0.10, 0,  0.10],
      [ 0.10, 0, -0.10], [-0.10, 0, -0.10],
    ];
    const guyMeshes: THREE.Mesh[] = guyPositions.map(([bx, , bz]) => {
      const dx = 0 - bx, dy = topY, dz = 0 - bz;
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const guyGeo = new THREE.CylinderGeometry(0.012, 0.012, len, 3);
      const guy = mesh(guyGeo, LANDMARK_SURFACE_GREY);
      guy.position.set(bx / 2, topY / 2, bz / 2);
      guy.lookAt(new THREE.Vector3(bx, 0, bz));
      guy.rotateX(Math.PI / 2);
      return guy;
    });

    // ── blinking beacon at apex ───────────────────────────────────────────────
    const beaconGeo = new THREE.SphereGeometry(0.025, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const beacon    = new THREE.Mesh(beaconGeo, glowMat(tintColor, 3.0));
    beacon.position.y = 1.38;

    const g = group(base, edges(base), ...barMeshes, ...guyMeshes, beacon);
    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, 1.38, 0));
    return g;
  }
}

