import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StreetRenderer } from '@/components/HexGrid/connections/StreetRenderer';
import { tileHeight } from '@/components/HexGrid/terrainUtils';
import type { Connection } from '@/types/connection';
import type { HexTile } from '@/types/hex';

describe('StreetRenderer', () => {
  const tiles: HexTile[] = [
    { coordinate: { q: 0, r: 0 }, elevation: 1, terrain: 'GRASS', ownerId: null },
    { coordinate: { q: 1, r: 0 }, elevation: 0, terrain: 'WATER', ownerId: null },
    { coordinate: { q: 2, r: 0 }, elevation: 1, terrain: 'GRASS', ownerId: null },
  ];

  const connection: Connection = {
    id: 'conn-1',
    originId: 'lm-1',
    targetId: 'lm-2',
    name: 'Main Street',
    type: 'STREET',
    path: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ],
  };

  it('renders street ribbon mesh with DoubleSide material so it is visible from below', () => {
    const renderer = new StreetRenderer();
    const group = renderer.build(connection, tiles);

    expect(group).not.toBeNull();
    const meshes: THREE.Mesh[] = [];
    group!.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });

    expect(meshes.length).toBeGreaterThan(0);
    // Find the street ribbon mesh (uses MeshLambertMaterial)
    const streetMesh = meshes.find((m) => (m.material as THREE.Material).type === 'MeshLambertMaterial');
    expect(streetMesh).toBeDefined();

    const mat = streetMesh!.material as THREE.MeshLambertMaterial;
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('creates bridge pylons over water tiles that stop below the street top surface', () => {
    const renderer = new StreetRenderer();
    const group = renderer.build(connection, tiles);

    expect(group).not.toBeNull();
    const meshes: THREE.Mesh[] = [];
    group!.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });

    // Pylon meshes use MeshToonMaterial and CylinderGeometry
    const pylonMeshes = meshes.filter(
      (m) => (m.material as THREE.Material).type === 'MeshToonMaterial' && m.geometry.type === 'CylinderGeometry',
    );
    expect(pylonMeshes.length).toBe(1);

    const pylon = pylonMeshes[0];
    const waterTile = tiles[1];
    const waterSurface = tileHeight(waterTile.elevation);

    // Elevated street parameters: LIFT = 0.10, BRIDGE_LIFT = 0.30, THICKNESS = 0.10
    const streetTopY = waterSurface + 0.10 + 0.30;
    const streetBottomY = streetTopY - 0.10;

    // Pylon top position = pylon.position.y + pillarH / 2
    // Expected pillar height = 0.30 (LIFT + BRIDGE_LIFT - THICKNESS)
    const pylonHeight = 0.30;
    const pylonTopY = pylon.position.y + pylonHeight / 2;

    expect(pylon.position.y).toBeCloseTo(waterSurface + pylonHeight / 2);
    expect(pylonTopY).toBeCloseTo(streetBottomY);
    expect(pylonTopY).toBeLessThan(streetTopY);
  });

  it('returns null if path has fewer than 2 coordinates', () => {
    const renderer = new StreetRenderer();
    const shortConn: Connection = {
      ...connection,
      path: [{ q: 0, r: 0 }],
    };
    expect(renderer.build(shortConn, tiles)).toBeNull();
  });
});
