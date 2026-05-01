import * as THREE from 'three';
import type { Connection } from '@/types/connection';
import type { HexTile } from '@/types/hex';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight } from '../terrainUtils';

const HEX_SIZE = 1;

export function resolvePoints(conn: Connection, tiles: HexTile[]): THREE.Vector3[] {
  const tileMap = new Map<string, HexTile>();
  for (const t of tiles) tileMap.set(`${t.coordinate.q},${t.coordinate.r}`, t);

  return conn.path.map(({ q, r }) => {
    const tile = tileMap.get(`${q},${r}`);
    const { x, z } = hexToWorld(q, r, HEX_SIZE);
    return new THREE.Vector3(x, tileHeight(tile?.elevation ?? 1) + 0.02, z);
  });
}

