import * as THREE from 'three';
import type { Connection, HexTile } from '@/types/map.ts';

export interface ConnectionRenderer {
  build(conn: Connection, tiles: HexTile[]): THREE.Group | null;
  /**
   * Called by HexGrid when the connection is removed from the scene.
   * Implementations should dispose any geometries that are unique to this
   * build call (shared/static geometries must NOT be disposed here).
   */
  dispose?(group: THREE.Group): void;
}
