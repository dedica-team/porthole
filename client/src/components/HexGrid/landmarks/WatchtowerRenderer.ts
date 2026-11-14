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
    LANDMARK_STONE,
    TRON_BLACK
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

        // 6 vertical line bars emerging from the edges of the platform to the edges of the roof to form window openings
        const postH = 0.36;
        const yBottom = 1.12;
        const yTop = yBottom + postH;
        const radius = 0.26;
        const linePoints: number[] = [];
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const x = radius * Math.sin(angle);
            const z = radius * Math.cos(angle);
            linePoints.push(x, yBottom, z, x, yTop, z);
        }
        const windowBarsGeo = new THREE.BufferGeometry();
        windowBarsGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
        const windowBars = new THREE.LineSegments(
            windowBarsGeo,
            new THREE.LineBasicMaterial({ color: TRON_BLACK })
        );

        // Hexagonal roof over the observation platform (platform top = 1.12, roof underside = 1.48, top = 1.54)
        const roofH = 0.06;
        const roofCenterY = yTop + roofH / 2;
        const roof = mesh(new THREE.CylinderGeometry(0.22, 0.26, roofH, 6), LANDMARK_STONE);
        roof.position.y = roofCenterY;
        const roofEdges = edges(roof); roofEdges.position.y = roofCenterY;

        const g = group(shaft, shaftEdges, platform, platformEdges, windowBars, roof, roofEdges);
        g.add(namePlane(landmark.name, tintColor));
        if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, roofCenterY + roofH / 2, 0));
        return g;
    }
}
