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
    LANDMARK_SURFACE_GREY
} from './landmarkUtils';

/** Wrap a mesh and its edge outline in a Group, then apply position/rotation to the Group. */
function placed(
    m: THREE.Mesh,
    x = 0, y = 0, z = 0,
    rx = 0, ry = 0, rz = 0,
): THREE.Group {
    const e = edges(m);
    const g = new THREE.Group();
    g.add(m, e);
    g.position.set(x, y, z);
    g.rotation.set(rx, ry, rz);
    return g;
}

export class OilPumpRenderer implements LandmarkRenderer {
    readonly requiresAdjacent = false;
    readonly color = 0x404040;

    build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
        const g = group();

        // ── base slab ─────────────────────────────────────────────────────────
        g.add(placed(mesh(new THREE.BoxGeometry(0.70, 0.06, 0.34), LANDMARK_SURFACE_GREY), 0, 0.03));

        // ── pump-house box ────────────────────────────────────────────────────
        g.add(placed(mesh(new THREE.BoxGeometry(0.18, 0.22, 0.22), tintColor), -0.22, 0.17));

        // ── exhaust pipe ──────────────────────────────────────────────────────
        g.add(placed(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 5), LANDMARK_SURFACE_GREY), -0.26, 0.36, 0.06));

        // ── pressure gauge on pump-house front ────────────────────────────────
        g.add(placed(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), tintColor), -0.22, 0.22, 0.12));

        // ── A-frame posts ─────────────────────────────────────────────────────
        const POST_H = 0.72;
        for (const z of [-0.09, 0.09]) {
            g.add(placed(mesh(new THREE.BoxGeometry(0.06, POST_H, 0.06), LANDMARK_SURFACE_GREY), 0.14, POST_H / 2, z));
        }

        // ── mid-height stiffener ──────────────────────────────────────────────
        g.add(placed(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), LANDMARK_SURFACE_GREY), 0.14, POST_H * 0.48));

        // ── diagonal X-braces ─────────────────────────────────────────────────
        const BRACE_Z = 0.09;
        for (const [z0, z1] of [[-BRACE_Z, BRACE_Z], [BRACE_Z, -BRACE_Z]] as [number, number][]) {
            const start = new THREE.Vector3(0.14, 0.06, z0);
            const end   = new THREE.Vector3(0.14, POST_H * 0.48, z1);
            const dir   = end.clone().sub(start);
            const len   = dir.length();
            const mid   = start.clone().add(end).multiplyScalar(0.5);
            const q     = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                dir.clone().normalize(),
            );
            const brace = mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 4), LANDMARK_SURFACE_GREY);
            const e = edges(brace);
            const bg = new THREE.Group();
            bg.add(brace, e);
            bg.position.copy(mid);
            bg.quaternion.copy(q);
            g.add(bg);
        }

        // ── crossbeam ─────────────────────────────────────────────────────────
        g.add(placed(mesh(new THREE.BoxGeometry(0.08, 0.06, 0.28), LANDMARK_SURFACE_GREY), 0.14, POST_H + 0.03));

        // ── pivot axle ────────────────────────────────────────────────────────
        g.add(placed(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.32, 6), tintColor), 0.14, POST_H + 0.02, 0, Math.PI / 2));

        // ── walking beam (front dips down) ────────────────────────────────────
        g.add(placed(mesh(new THREE.BoxGeometry(0.62, 0.05, 0.07), LANDMARK_SURFACE_GREY), 0.14, POST_H + 0.05, 0, 0, 0, -0.22));

        // ── counterweight box ─────────────────────────────────────────────────
        g.add(placed(mesh(new THREE.BoxGeometry(0.14, 0.10, 0.10), LANDMARK_SURFACE_GREY), 0.14 + 0.26, POST_H));

        // ── horsehead ─────────────────────────────────────────────────────────
        const horseHeadX = 0.14 - 0.28;
        const horseHeadY = POST_H + 0.13 - Math.sin(0.22) * 0.31;
        g.add(placed(mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.08, 6), LANDMARK_SURFACE_GREY), horseHeadX, horseHeadY));

        // ── wellhead collar ───────────────────────────────────────────────────
        g.add(placed(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 8), LANDMARK_SURFACE_GREY), horseHeadX, 0.04));

        // ── pump rod ──────────────────────────────────────────────────────────
        g.add(placed(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 5), LANDMARK_SURFACE_GREY), horseHeadX, POST_H - 0.062 - 0.13));

        g.add(namePlane(landmark.name, tintColor));
        if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, -0.22, 0.28, 0));
        return g;
    }
}
