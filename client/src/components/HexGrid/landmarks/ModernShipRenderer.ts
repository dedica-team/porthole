import * as THREE from 'three';
import type { Landmark, QualityLevel } from '@/types/map.ts';
import { mesh, edges, namePlane, group, statusLight, type LandmarkRenderer, LANDMARK_SURFACE_GREY, TRON_BLACK } from './landmarkUtils';

/** Like `edges()` but uses a higher threshold angle (degrees) so only real
 *  silhouette creases show up, not every triangle diagonal in the hull mesh. */
function hullEdges(m: THREE.Mesh, thresholdAngle = 15): THREE.LineSegments {
  const eg = new THREE.EdgesGeometry(m.geometry, thresholdAngle);
  return new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: TRON_BLACK }));
}

/**
 * Pointed ship-hull prism – bow (positive-X) tapers to a centre ridge,
 * stern (negative-X) is full-width.
 */
function hullGeo(length: number, width: number, height: number): THREE.BufferGeometry {
  const h = height, l = length, w = width;
  const verts = new Float32Array([
    -l / 2,  0,  w,   -l / 2,  0, -w,   // 0,1 stern bottom
    -l / 2,  h,  w,   -l / 2,  h, -w,   // 2,3 stern top
     l / 2,  0,  0,    l / 2,  h,  0,   // 4,5 bow centre
  ]);
  const idx = new Uint16Array([
    0, 1, 3,  0, 3, 2,   // stern
    0, 2, 5,  0, 5, 4,   // port side
    1, 4, 5,  1, 5, 3,   // starboard side
    0, 4, 1,             // bottom
    2, 3, 5,             // top
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.rotateY(Math.PI ); // point bow along +X
  return geo;
}

export class ModernShipRenderer implements LandmarkRenderer {
  readonly requiresAdjacent = false;
  readonly color = 0x5599dd;

  build(landmark: Landmark, _elevation: number, tintColor: THREE.Color, _adj?: undefined, worstLevel?: QualityLevel): THREE.Group {
    const g = group();

    // ── main hull – pointed bow ───────────────────────────────────────────
    const hull = mesh(hullGeo(1.10, 0.19, 0.18), LANDMARK_SURFACE_GREY);
    (hull.material as THREE.Material).side = THREE.DoubleSide;
    hull.position.y = 0.0;
    const hullE = hullEdges(hull); hullE.position.y = 0.0;
    g.add(hull, hullE);

    // ── upper hull / deck ─────────────────────────────────────────────────
    const deck = mesh(hullGeo(1.0, 0.15, 0.08), LANDMARK_SURFACE_GREY);
    (deck.material as THREE.Material).side = THREE.DoubleSide;
    deck.position.set(0.0, 0.18, 0);
    const deckE = hullEdges(deck); deckE.position.set(0.0, 0.18, 0);
    g.add(deck, deckE);

    // ── bridge superstructure ─────────────────────────────────────────────
    const bridge = mesh(new THREE.BoxGeometry(0.22, 0.12, 0.2), tintColor);
    bridge.position.set(0.30, 0.33, 0);
    const bridgeEdges = edges(bridge); bridgeEdges.position.set(0.30, 0.33, 0);
    g.add(bridge, bridgeEdges);

    // ── bridge windows – west (bow-facing) face ───────────────────────────
    const windows = mesh(new THREE.BoxGeometry(0.02, 0.05, 0.18), new THREE.Color(0x001122));
    windows.position.set(0.30 - 0.11 - 0.01, 0.35, 0);
    g.add(windows);

    // ── radar mast ────────────────────────────────────────────────────────
    const mast = mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.14, 4), LANDMARK_SURFACE_GREY);
    mast.position.set(0.35, 0.46, 0);
    mast.rotateZ(-Math.PI / 12);
    g.add(mast);

    g.add(namePlane(landmark.name, tintColor));
    if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel, 0.28, 0.40, 0));
    return g;
  }
}
