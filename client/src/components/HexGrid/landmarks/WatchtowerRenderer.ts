import * as THREE from 'three';
import type { Landmark } from '@/types/landmark';
import type { QualityLevel } from '@/types/landmark';
import {
    mesh,
    edges,
    namePlane,
    group,
    statusLight,
    type LandmarkRenderer,
    LANDMARK_STONE
} from './landmarkUtils';

export class WatchtowerRenderer implements LandmarkRenderer {
    readonly requiresAdjacent = false;
    readonly color = 0x506888;

    build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
        const shaft    = mesh(new THREE.CylinderGeometry(0.13, 0.18, 1.0, 6), LANDMARK_STONE);
        shaft.position.y = 0.5;
        const shaftEdges = edges(shaft); shaftEdges.position.y = 0.5;
        const platform = mesh(new THREE.CylinderGeometry(0.26, 0.20, 0.12, 6), tintColor);
        platform.position.y = 1.06;
        const platformEdges = edges(platform); platformEdges.position.y = 1.06;
        // flat hexagonal grey roof sitting on top of the platform (platform top = 1.12)
        const roofH = 0.04;
        const roof = mesh(new THREE.CylinderGeometry(0.30, 0.28, roofH, 6), LANDMARK_STONE);
        roof.position.y = 1.12 + roofH / 2;
        const roofEdges = edges(roof); roofEdges.position.y = 1.12 + roofH / 2;
        const g = group(shaft, shaftEdges, platform, platformEdges, roof, roofEdges);
        g.add(namePlane(landmark.name, tintColor));
        if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, 1.12 + roofH, 0));
        return g;
    }
}
