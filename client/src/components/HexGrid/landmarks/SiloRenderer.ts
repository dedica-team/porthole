import * as THREE from 'three';
import type { Landmark } from '@/types/landmark';
import type { QualityLevel } from '@/types/landmark';
import {mesh, edges, namePlane, group, glowMat, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY} from './landmarkUtils';

export class SiloRenderer implements LandmarkRenderer {
    readonly requiresAdjacent = false;
    readonly color = 0xb0c0a0;

    build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
        const body = mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.90, 8), LANDMARK_SURFACE_GREY);
        body.position.y = 0.45;
        const bodyEdges = edges(body); bodyEdges.position.y = 0.45;
        const domeGeo = new THREE.SphereGeometry(0.21, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        const dome = mesh(domeGeo, tintColor);
        dome.position.y = 0.90;
        const domeGlow = new THREE.Mesh(domeGeo, glowMat(tintColor, 2.2));
        domeGlow.position.y = 0.90;
        const g = group(body, bodyEdges, dome, domeGlow);
        g.add(namePlane(landmark.name, tintColor));
        if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, 1.11, 0));
        return g;
    }
}
