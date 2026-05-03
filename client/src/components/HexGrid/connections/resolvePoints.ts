import * as THREE from 'three';
import type { Connection } from '@/types/connection';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight } from '../terrainUtils';
import type { TileLookup } from './ConnectionRenderer.ts';

const HEX_SIZE = 1;

export function resolvePoints(conn: Connection, tileLookup: TileLookup): THREE.Vector3[] {
  return conn.path.map(({ q, r }) => {
    const tile = tileLookup.get(`${q},${r}`);
    const { x, z } = hexToWorld(q, r, HEX_SIZE);
    return new THREE.Vector3(x, tileHeight(tile?.elevation ?? 1) + 0.02, z);
  });
}

