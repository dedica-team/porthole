/**
 * Atomic reactor – PWR / RBMK style.
 *
 * Structure:
 *  - wide concrete containment cylinder (grey)
 *  - domed cap on top
 *  - two small cooling towers flanking
 *  - steam plume glow above towers
 *  - status light on dome apex
 */
import * as THREE from 'three';
import type { Landmark } from '@/types/map.ts';
import type { QualityLevel } from '@/types/map.ts';
import { mesh, edges, namePlane, group, glowMat, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY } from './landmarkUtils';

export class AtomicReactorRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0x70c890;

  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    // ── main containment building ─────────────────────────────────────────────
    const bodyH = 0.40;
    const body = mesh(new THREE.CylinderGeometry(0.22, 0.25, bodyH, 10), LANDMARK_SURFACE_GREY);
    body.position.y = bodyH / 2;

    // dome cap
    const domeGeo = new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = mesh(domeGeo, LANDMARK_SURFACE_GREY);
    dome.position.y = bodyH;

    // tinted band around the dome base – shared geometry for mesh + glow
    const bandGeo = new THREE.TorusGeometry(0.22, 0.025, 6, 20);
    const band = mesh(bandGeo, tintColor);
    band.rotation.x = Math.PI / 2;
    band.position.y = bodyH + 0.01;
    const bandGlow = new THREE.Mesh(bandGeo, glowMat(tintColor, 1.5));
    bandGlow.rotation.x = Math.PI / 2;
    bandGlow.position.y = bodyH + 0.01;

    // ── cooling towers (two, flanking) ────────────────────────────────────────
    const towerPositions: [number, number][] = [[-0.55, 0.0], [0.55, 0.0]];
    const towerH = 0.80;
    // hyperbolic lathe profile: wide base → concave waist → slightly wider rim
    const towerProfile = [
      new THREE.Vector2(0.28, 0.00),   // base outer edge
      new THREE.Vector2(0.26, 0.08),   // lower taper
      new THREE.Vector2(0.19, 0.44),   // waist (narrowest)
      new THREE.Vector2(0.22, 0.64),   // upper flare
      new THREE.Vector2(0.23, towerH), // rim
    ];
    const towerGeo = new THREE.LatheGeometry(towerProfile, 16);
    const towerMeshes: THREE.Object3D[] = [];
    towerPositions.forEach(([x, z]) => {
      const tower = mesh(towerGeo, LANDMARK_SURFACE_GREY);
      (tower.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
      tower.position.set(x, 0, z);
      const towerEdge = edges(tower); towerEdge.position.copy(tower.position);

      towerMeshes.push(tower, towerEdge);
    });

    const g = group(body, edges(body), dome, band, bandGlow, ...towerMeshes);
    g.add(namePlane(landmark.name, tintColor));
    // status light on dome apex (dome centre bodyH + sphere radius 0.32 → apex ≈ bodyH + 0.32)
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, bodyH + 0.22, 0));
    return g;
  }
}

