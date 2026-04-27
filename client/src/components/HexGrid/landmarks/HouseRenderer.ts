import * as THREE from 'three';
import type { Landmark } from '@/types/map.ts';
import type { QualityLevel } from '@/types/map.ts';
import { mesh, namePlane, group, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY } from './landmarkUtils';

// Two rows of three: col spacing 0.28, row spacing 0.30
// [w, d, h]
const LAYOUT: [number, number, number][] = [
  [0.18, 0.14, 0.22],
  [0.16, 0.14, 0.18],
  [0.18, 0.14, 0.26],
  [0.16, 0.14, 0.20],
  [0.18, 0.14, 0.16],
  [0.16, 0.14, 0.24],
];

const RECESS = 0.008;  // how far door/window cuboids protrude from face

function buildingGroup(w: number, d: number, h: number, tintColor: THREE.Color): THREE.Group {
  const g = group();

  // ── main body ──────────────────────────────────────────────────────────
  const body = mesh(new THREE.BoxGeometry(w, h, d), LANDMARK_SURFACE_GREY);
  body.position.y = h / 2;
  g.add(body);

  const fz = d / 2 + RECESS / 2;  // z-centre of front-face details

  // ── door: lower-centre, 35% wide, 55% tall ────────────────────────────
  const dw = w * 0.35, dh = h * 0.55;
  const door = mesh(new THREE.BoxGeometry(dw, dh, RECESS), tintColor);
  door.position.set(0, dh / 2, fz);
  g.add(door);

  return g;
}

export class HouseRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0xe08060;

  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    const g = group();

    LAYOUT.forEach(([w, d, h], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = col * 0.28 - 0.28;
      const z = row * 0.30 - 0.15;

      const b = buildingGroup(w, d, h, tintColor);
      b.position.set(x, 0, z);
      g.add(b);
    });

    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0.28, 0.26, -0.15));
    return g;
  }
}
