import * as THREE from 'three';
import type { SessionState } from '@/types/session';
// Module-level singletons – avoids per-call allocation on every pointermove.
const _raycaster = new THREE.Raycaster();
const _ndc       = new THREE.Vector2();

/**
 * Picks a tile coordinate from the merged top mesh using a raycaster.
 * Returns null if no tile was hit.
 */
export function pickTileFromMesh(
  clientX: number,
  clientY: number,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  topsMesh: THREE.Mesh,
  tiles: SessionState['map']['tiles'],
): { q: number; r: number } | null {
  const rect = renderer.domElement.getBoundingClientRect();
  _ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(topsMesh);
  if (!hits.length) return null;
  const idx = hits[0].face?.materialIndex ?? -1;
  const tile = tiles[idx];
  return tile ? tile.coordinate : null;
}

