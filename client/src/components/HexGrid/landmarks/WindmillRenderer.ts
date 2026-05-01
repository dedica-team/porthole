import * as THREE from 'three';
import type { Landmark } from '@/types/landmark';
import type { QualityLevel } from '@/types/landmark';
import { mat, mesh, edges, namePlane, group, glowMat, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY } from './landmarkUtils';

export class WindmillRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0xa0d080;
  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    const mast = mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.90, 6), LANDMARK_SURFACE_GREY); mast.position.y = 0.45;
    const hub  = mesh(new THREE.SphereGeometry(0.065, 6, 4), LANDMARK_SURFACE_GREY); hub.position.y = 0.92;
    const rotor = new THREE.Group(); rotor.position.set(0, 0.92, 0.08);
    const BLADE_LEN = 0.36, BLADE_W = 0.09;
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo( BLADE_W * 0.6,  BLADE_LEN * 0.2);
    bladeShape.lineTo( BLADE_W * 0.5,  BLADE_LEN);
    bladeShape.lineTo(-BLADE_W * 0.15, BLADE_LEN * 0.9);
    bladeShape.lineTo(-BLADE_W * 0.3,  BLADE_LEN * 0.1);
    bladeShape.closePath();
    const bladeGeo = new THREE.ShapeGeometry(bladeShape);
    for (let i = 0; i < 3; i++) {
      // Base blade with toon material
      const blade = new THREE.Mesh(bladeGeo, mat(tintColor));
      blade.rotation.z = (Math.PI * 2 / 3) * i;
      rotor.add(blade);
      // Glow overlay on each blade
      const bladeGlow = new THREE.Mesh(bladeGeo, glowMat(tintColor, 2.0));
      bladeGlow.rotation.z = (Math.PI * 2 / 3) * i;
      rotor.add(bladeGlow);
    }
    const noseCap = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 6), tintColor);
    noseCap.rotation.x = Math.PI / 2; noseCap.position.z = 0.015;
    rotor.add(noseCap);
    rotor.rotation.z = Math.PI / 4;
    const g = group(mast, edges(mast), hub, rotor);
    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, 0.98, 0));
    return g;
  }
}
