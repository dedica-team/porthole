/**
 * SETI-style large parabolic satellite dish on a tiltable mount.
 *
 * Structure:
 *  - concrete base pad
 *  - central support column
 *  - yoke (U-frame) bearing the dish
 *  - parabolic dish (lathed half-sphere, open face forward)
 *  - small feed-horn at focal point
 *  - glow on the dish interior
 */
import * as THREE from 'three';
import type { Landmark } from '@/types/landmark';
import type { QualityLevel } from '@/types/landmark';
import { mesh, namePlane, group, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY } from './landmarkUtils';

export class SatelliteDishRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0xa0b8d0;

  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {

    // ── support column ────────────────────────────────────────────────────────
    const colGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.57, 8);
    const col = mesh(colGeo, LANDMARK_SURFACE_GREY);
    col.position.y = 0.36;

    // black edge lines on the column
    const colEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(colGeo),
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    col.add(colEdges);

    // ── dish group (tilted 35° forward) ──────────────────────────────────────
    const dishGroup = new THREE.Group();
    dishGroup.position.set(0, 0.96, 0);
    dishGroup.rotation.x = -Math.PI * 0.20;   // tilt toward south

    // parabolic bowl: half-sphere open toward +Z (viewer side)
    const dishGeo = new THREE.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const dishMesh = mesh(dishGeo, LANDMARK_SURFACE_GREY);
    (dishMesh.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
    dishMesh.rotation.x = Math.PI / 2;
    dishMesh.rotation.z = Math.PI;

    // rim ring
    const rim = mesh(new THREE.TorusGeometry(0.34, 0.015, 6, 24), tintColor);
    rim.rotation.z = Math.PI;

    // feed horn at focal point (≈ 0.20 in front of dish centre)
    const horn = mesh(new THREE.ConeGeometry(0.04, 0.10, 6), tintColor);
    horn.rotation.x = -Math.PI / 2;
    horn.position.z = 0.20;

    // strut from back of dish (z = -dishRadius = -0.34) to horn (z = 0.20)
    const strutStart = -0.34;
    const strutEnd   =  0.20;
    const strutLen   = strutEnd - strutStart;           // 0.54
    const strutGeo = new THREE.CylinderGeometry(0.008, 0.008, strutLen, 4);
    const strut = mesh(strutGeo, LANDMARK_SURFACE_GREY);
    strut.rotation.x = Math.PI / 2;
    strut.position.z = strutStart + strutLen / 2;       // centred between back and horn

    dishGroup.add(dishMesh, rim, horn, strut);

    const g = group(col, dishGroup);
    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0.0, 0.05, 0.2));
    return g;
  }
}

