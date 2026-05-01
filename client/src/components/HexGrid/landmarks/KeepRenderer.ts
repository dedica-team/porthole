import * as THREE from 'three';
import type { Landmark } from '@/types/landmark';
import type { QualityLevel } from '@/types/landmark';
import {mesh, edges, namePlane, group, glowMat, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY} from './landmarkUtils';

export class KeepRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0x6080b0;
  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    const body = mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.8, 8), LANDMARK_SURFACE_GREY);
    const top  = mesh(new THREE.CylinderGeometry(0.20, 0.28, 0.35, 8), LANDMARK_SURFACE_GREY);
    top.position.y = 0.575;
    const torus = mesh(new THREE.TorusGeometry(0.24, 0.04, 4, 8), tintColor);
    torus.rotation.x = Math.PI / 2; torus.position.y = 0.78;
    const torusGlow = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 4, 8), glowMat(tintColor, 2.2));
    torusGlow.rotation.x = Math.PI / 2; torusGlow.position.y = 0.78;
    const g = group(body, edges(body), top, edges(top), torus, torusGlow);
    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, 0.80, 0));
    return g;
  }
}
