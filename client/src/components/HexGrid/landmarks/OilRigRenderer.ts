import * as THREE from 'three';
import type { Landmark, QualityLevel } from '@/types/landmark';
import { mesh, edges, namePlane, group, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY } from './landmarkUtils';

export class OilRigRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0xdd8833;

  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    const g = group();

    // ── four corner legs ──────────────────────────────────────────────────
    const LEG_POSITIONS: [number, number][] = [[-0.30, -0.22], [0.30, -0.22], [-0.30, 0.22], [0.30, 0.22]];
    for (const [x, z] of LEG_POSITIONS) {
      const leg = mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.62, 5), LANDMARK_SURFACE_GREY);
      leg.position.set(x, 0.31, z);
      const legEdges = edges(leg); legEdges.position.set(x, 0.31, z);
      g.add(leg, legEdges);
    }

    // ── cross-braces at mid height ────────────────────────────────────────
    const BRACE_PAIRS: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(-0.30, 0.22, -0.22), new THREE.Vector3(0.30, 0.22, 0.22)],
      [new THREE.Vector3(0.30, 0.22, -0.22),  new THREE.Vector3(-0.30, 0.22, 0.22)],
      [new THREE.Vector3(-0.30, 0.22, -0.22), new THREE.Vector3(-0.30, 0.22, 0.22)],
      [new THREE.Vector3(0.30, 0.22, -0.22),  new THREE.Vector3(0.30, 0.22, 0.22)],
      [new THREE.Vector3(-0.30, 0.22, -0.22), new THREE.Vector3(0.30, 0.22, -0.22)],
      [new THREE.Vector3(-0.30, 0.22, 0.22),  new THREE.Vector3(0.30, 0.22, 0.22)],
    ];
    for (const [a, b] of BRACE_PAIRS) {
      const dir = b.clone().sub(a);
      const len = dir.length();
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const q   = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const brace = mesh(new THREE.CylinderGeometry(0.016, 0.016, len, 4), LANDMARK_SURFACE_GREY);
      const bg = new THREE.Group();
      bg.add(brace);
      bg.position.copy(mid);
      bg.quaternion.copy(q);
      g.add(bg);
    }

    // ── main platform deck ────────────────────────────────────────────────
    const deck = mesh(new THREE.BoxGeometry(0.78, 0.06, 0.58), LANDMARK_SURFACE_GREY);
    deck.position.set(0, 0.65, 0);
    const deckEdges = edges(deck); deckEdges.position.set(0, 0.65, 0);
    g.add(deck, deckEdges);

    // ── helideck (round flat platform at one end) ─────────────────────────
    const heli = mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.03, 8), tintColor);
    heli.position.set(-0.30, 0.70, 0);
    const heliEdges = edges(heli); heliEdges.position.set(-0.30, 0.70, 0);
    g.add(heli, heliEdges);
    // helideck H marking (two crossed thin boxes)
    for (const ry of [0, Math.PI / 2]) {
      const bar = mesh(new THREE.BoxGeometry(0.28, 0.008, 0.03), new THREE.Color(0xffffff));
      bar.position.set(-0.30, 0.72, 0);
      bar.rotation.y = ry;
      g.add(bar);
    }

    // ── drilling tower / derrick ──────────────────────────────────────────
    const DERRICK_H = 0.80;
    for (const [x, z] of [[-0.09, -0.08], [0.09, -0.08], [-0.09, 0.08], [0.09, 0.08]] as [number, number][]) {
      const post = mesh(new THREE.CylinderGeometry(0.018, 0.022, DERRICK_H, 4), LANDMARK_SURFACE_GREY);
      post.position.set(x + 0.14, 0.68 + DERRICK_H / 2, z);
      g.add(post);
    }
    const crown = mesh(new THREE.BoxGeometry(0.22, 0.05, 0.22), tintColor);
    crown.position.set(0.14, 0.68 + DERRICK_H + 0.025, 0);
    const crownEdges = edges(crown); crownEdges.position.set(0.14, 0.68 + DERRICK_H + 0.025, 0);
    g.add(crown, crownEdges);

    // ── flare stack + glow ────────────────────────────────────────────────
    const flare = mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.38, 5), LANDMARK_SURFACE_GREY);
    flare.position.set(0.34, 0.87, 0.22);
    g.add(flare);

    // ── crane arm ─────────────────────────────────────────────────────────
    const arm = mesh(new THREE.BoxGeometry(0.40, 0.03, 0.03), LANDMARK_SURFACE_GREY);
    arm.position.set(0.34, 0.86, -0.22);
    arm.rotation.y = 0.3;
    const armEdges = edges(arm); armEdges.position.set(0.34, 0.86, -0.22); armEdges.rotation.y = 0.3;
    g.add(arm, armEdges);

    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0.14, 1.52, 0));
    return g;
  }
}
