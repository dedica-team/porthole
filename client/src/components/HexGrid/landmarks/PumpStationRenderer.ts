import * as THREE from 'three';
import type {Landmark} from '@/types/map.ts';
import type { QualityLevel } from '@/types/map.ts';
import {mesh, edges, namePlane, group, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY} from './landmarkUtils';

const PIPE_R  = 0.04;

export class PumpStationRenderer implements LandmarkRenderer {
    readonly requiresAdjacent = false;
    readonly color = 0x7090a8;

    build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
        const base = mesh(new THREE.BoxGeometry(0.65, 0.28, 0.50), LANDMARK_SURFACE_GREY);
        base.position.y = 0.14;
        const drum = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.30, 8), tintColor);
        drum.position.set(0.1, 0.43, 0);

        // Drum bottom face: y = 0.43 - 0.15 = 0.28
        // We need the arc to start at the drum bottom (y=0.28) and end at y=0.
        // A quarter-torus of major radius R spans exactly R in both X and Y,
        // so set BEND_R = 0.28 = drumBottomY for the arc to close at ground level.
        //
        // Default arc (rotation=0): start=(+R,0), end=(0,+R)  — CCW in XY plane.
        // We want:  start=(0, drumBottomY) entering from +Y (straight down from drum)
        //           end  =(−R, 0)          exiting toward −X
        // That means rotating the default 90° CCW: rotation.z = +π/2
        //   default start (R,0)  → rotated (0,  R)  ✓  at y=drumBottomY
        //   default end   (0,R)  → rotated (−R, 0)  ✓  at y=0, x=pivot.x−R
        // pivot sits at (drumEdgeX + R, 0) so that:
        //   start.x = pivot.x         = drumEdgeX + R ... we want it at drumEdgeX
        // Correct pivot.x = drumEdgeX so start.x = drumEdgeX ✓
        //   end.x   = pivot.x - R     = drumEdgeX - R  (outside base, to the left) ✓
        const BEND_R    = 0.23;   // = 0.28 = drum bottom Y, arc reaches exactly y=0
        const drumEdgeX = - 0.25;

        const makeBend = (zOffset: number) => {
            const bend = mesh(
                new THREE.TorusGeometry(BEND_R, PIPE_R, 6, 12, Math.PI / 2),
                LANDMARK_SURFACE_GREY,
            );
            (bend.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
            bend.rotation.z = Math.PI / 2;
            // pivot: start lands at (drumEdgeX, drumBottomY), end at (drumEdgeX−BEND_R, 0)
            bend.position.set(drumEdgeX, 0, zOffset);
            return bend;
        };

        const g = group(
            base, edges(base),
            drum, edges(drum),
            makeBend(-0.10),
            makeBend( 0.10),
        );
        g.add(namePlane(landmark.name, tintColor));
        if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0.1, 0.58, 0));
        return g;
    }
}
