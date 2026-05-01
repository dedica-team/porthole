import * as THREE from 'three';
import type { Landmark } from '@/types/landmark';
import type { QualityLevel } from '@/types/landmark';
import { mesh, edges, namePlane, group, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY } from './landmarkUtils';

// ── helpers ───────────────────────────────────────────────────────────────────
function block(
  w: number, h: number, d: number,
  color: THREE.Color,
  x: number, y: number, z: number,
  rx = 0, ry = 0, rz = 0,
): THREE.Group {
  const m = mesh(new THREE.BoxGeometry(w, h, d), color);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  const e = edges(m);
  e.position.copy(m.position);
  e.rotation.copy(m.rotation);
  return group(m, e);
}

const CRACK_TILT = 0.18;
const S = LANDMARK_SURFACE_GREY; // stone

export class RuinsRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0x907060;

  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    const g = group();
    const T = tintColor;

    // ── centre fractured block (two tilted halves) ────────────────────────
    const halfL = mesh(new THREE.BoxGeometry(0.18, 0.40, 0.20), S);
    halfL.position.set(-0.06, 0.20, 0.0);
    halfL.rotation.set(0, 0, -CRACK_TILT);
    const halfLEdges = edges(halfL);
    halfLEdges.position.copy(halfL.position);
    halfLEdges.rotation.copy(halfL.rotation);
    g.add(halfL, halfLEdges);

    const halfR = mesh(new THREE.BoxGeometry(0.18, 0.40, 0.20), S);
    halfR.position.set(0.06, 0.18, 0.0);
    halfR.rotation.set(0, 0, CRACK_TILT);
    const halfREdges = edges(halfR);
    halfREdges.position.copy(halfR.position);
    halfREdges.rotation.copy(halfR.rotation);
    g.add(halfR, halfREdges);

    // crack accent
    const crack = mesh(new THREE.BoxGeometry(0.04, 0.36, 0.18), T);
    crack.position.set(0, 0.18, 0.0);
    const crackEdges = edges(crack);
    crackEdges.position.copy(crack.position);
    g.add(crack, crackEdges);

    // ── scattered debris blocks ───────────────────────────────────────────
    // [w,    h,    d,    x,      y,      z,      rx,    ry,    rz,   color]
    // y < h/2  → piece is semi-sunken into the ground
    const debris: [number,number,number, number,number,number, number,number,number, THREE.Color][] = [
      // flat slabs
      [0.22, 0.06, 0.16,  0.22,  0.01,  0.12,   0.18,  0.40,  0.10, S],
      [0.18, 0.05, 0.20, -0.24,  0.00, -0.08,  -0.12, -0.55,  0.08, S],
      [0.20, 0.07, 0.14,  0.08,  0.01,  0.28,   0.20,  0.70, -0.12, T],
      [0.16, 0.05, 0.18, -0.10,  0.00, -0.30,  -0.15,  0.35,  0.10, S],
      // tall shards
      [0.08, 0.22, 0.08,  0.32,  0.06, -0.16,   0.40,  1.10,  0.45, S],
      [0.07, 0.18, 0.09, -0.30,  0.05,  0.18,  -0.35, -0.80, -0.42, T],
      // chunky pieces
      [0.18, 0.12, 0.10,  0.18,  0.02, -0.28,   0.22,  2.10,  0.30, S],
      [0.14, 0.10, 0.16, -0.20,  0.02,  0.26,  -0.25, -1.60, -0.28, S],
    ];
    for (const [w,h,d, x,y,z, rx,ry,rz, col] of debris) {
      g.add(block(w, h, d, col, x, y, z, rx, ry, rz));
    }

    // ── fallen bars ───────────────────────────────────────────────────────
    // [len,  x,      y,     z,      rx,    ry,    rz]
    const bars: [number, number,number,number, number,number,number][] = [
      [0.54, -0.42,  0.01,  0.52,   0.25,  0.55,  0.10],
      [0.44,  0.58,  0.01, -0.30,  -0.20, -0.70, -0.08],
      [0.36, -0.60,  0.01,  0.20,   0.30,  1.20,  0.12],
      [0.48,  0.18,  0.01, -0.62,  -0.18, -0.30,  0.15],
      [0.38,  0.24,  0.01,  0.40,   1.32,  2.00, -0.10],
    ];
    for (const [len, x,y,z, rx,ry,rz] of bars) {
      g.add(block(len, 0.06, 0.08, T, x, y, z, rx, ry, rz));
    }

    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0, 0.41, 0));
    return g;
  }
}
