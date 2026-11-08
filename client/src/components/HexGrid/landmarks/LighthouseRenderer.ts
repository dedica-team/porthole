import * as THREE from 'three';
import type { Landmark } from '@/types/landmark';
import {mesh, edges, namePlane, group, glowMat, statusLight, type LandmarkRenderer, LANDMARK_MARITIME} from './landmarkUtils';
import type { QualityLevel } from '@/types/landmark';
export class LighthouseRenderer implements LandmarkRenderer {
    readonly requiresAdjacent = false;
    readonly color = 0xf0c040;

    build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
        const body = mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 10), LANDMARK_MARITIME);
        body.position.y = 0.55;
        const lanternGeo = new THREE.CylinderGeometry(0.20, 0.18, 0.22, 10);
        const lantern = mesh(lanternGeo, tintColor);
        lantern.position.y = 1.21;
        const lanternGlow = new THREE.Mesh(lanternGeo, glowMat(tintColor, 2.2));
        lanternGlow.position.y = 1.21;
        const cap = mesh(new THREE.ConeGeometry(0.22, 0.2, 10), LANDMARK_MARITIME);
        cap.position.y = 1.43;
        const g = group(body, edges(body), lantern, edges(lantern), lanternGlow, cap);
        g.add(namePlane(landmark.name, tintColor));
        if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, 1.52, 0));
        return g;
    }
}
