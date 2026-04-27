/**
 * Portal – a standing toroidal ring like a stargate.
 *
 * Structure:
 *  - two foot pylons
 *  - thick outer ring (torus, upright)
 *  - inner energy disc (circle of triangles, additive glow)
 *  - shimmering glow overlay on ring
 *  - rotating inner vortex ring
 */
import * as THREE from 'three';
import type {Landmark} from '@/types/map.ts';
import type {QualityLevel} from '@/types/map.ts';
import {
    mesh,
    edges,
    namePlane,
    group,
    glowMat,
    statusLight,
    type LandmarkRenderer,
    LANDMARK_SURFACE_GREY
} from './landmarkUtils';
import {TRON_CYAN} from "@/components/HexGrid/terrainUtils.ts";

export class PortalRenderer implements LandmarkRenderer {
    readonly requiresAdjacent = false;
    readonly color = 0x40e0ff;

    build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
        const RING_R = 0.42;   // major radius of torus
        const RING_T = 0.055;  // tube radius
        const RING_Y = 0.56;   // ring centre height

        // ── foot pylons ───────────────────────────────────────────────────────────
        const pylonGeo = new THREE.BoxGeometry(0.09, 0.28, 0.09);
        const pylonL = mesh(pylonGeo, LANDMARK_SURFACE_GREY);
        pylonL.position.set(-RING_R + 0.12, 0.12, 0);
        pylonL.add(edges(pylonL));
        const pylonR = mesh(pylonGeo, LANDMARK_SURFACE_GREY);
        pylonR.position.set(RING_R - 0.12, 0.12, 0);
        pylonR.add(edges(pylonR));

        // ── outer ring ────────────────────────────────────────────────────────────
        const ringGeo = new THREE.TorusGeometry(RING_R, RING_T, 12, 48);
        const ring = mesh(ringGeo, LANDMARK_SURFACE_GREY);
        ring.position.y = RING_Y;

        // inner decoration ring (thinner, tinted)
        const innerRing = mesh(new THREE.TorusGeometry(RING_R * 0.80, RING_T * 0.5, 8, 36), tintColor);
        innerRing.position.y = RING_Y;
        const innerGlow = new THREE.Mesh(
            new THREE.TorusGeometry(RING_R * 0.80, RING_T * 0.5, 8, 36),
            glowMat(tintColor, 3.5),
        );
        innerGlow.position.y = RING_Y;

        // ── energy disc ───────────────────────────────────────────────────────────
        const discGeo = new THREE.CircleGeometry(RING_R - RING_T, 32);
        const disc = new THREE.Mesh(discGeo, glowMat(new THREE.Color(TRON_CYAN), 0.55));
        // CircleGeometry faces +Z by default – matches the upright ring opening
        disc.position.y = RING_Y;

        // back face (faces -Z)
        const discBack = new THREE.Mesh(discGeo, glowMat(new THREE.Color(TRON_CYAN), 0.35));
        discBack.rotation.y = Math.PI;
        discBack.position.y = RING_Y;

        const g = group(
            pylonL, pylonR,
            ring, innerRing, innerGlow,
            disc, discBack,
        );
        g.add(namePlane(landmark.name, tintColor));
        if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, RING_Y + RING_R + 0.05, RING_T - 0.05));
        return g;
    }
}
