import * as THREE from 'three';
import type { Landmark } from '@/types/landmark';
import type { QualityLevel } from '@/types/landmark';
import {mesh, edges, namePlane, group, glowMat, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY} from './landmarkUtils';

export class FurnaceRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0xd05030;
  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    const body        = mesh(new THREE.BoxGeometry(0.54, 0.50, 0.46), LANDMARK_SURFACE_GREY); body.position.y = 0.25;
    const chimneyGeo  = new THREE.BoxGeometry(0.13, 0.62, 0.13);
    const chimney     = mesh(chimneyGeo, tintColor);                                          chimney.position.set(0.17, 0.81, 0.10);
    const chimneyGlow = new THREE.Mesh(chimneyGeo, glowMat(tintColor, 2.2));                  chimneyGlow.position.set(0.17, 0.81, 0.10);
    const glow        = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 6), tintColor);  glow.position.set(0.17, 1.135, 0.10);
    const door        = mesh(new THREE.BoxGeometry(0.15, 0.19, 0.03), LANDMARK_SURFACE_GREY); door.position.set(-0.08, 0.165, 0.245);
    const g = group(body, edges(body), chimney, chimneyGlow, glow, door);
    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0.17, 1.155, 0.10));
    return g;
  }
}
