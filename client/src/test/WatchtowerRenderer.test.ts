import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WatchtowerRenderer } from '@/components/HexGrid/landmarks/WatchtowerRenderer';
import type { Landmark } from '@/types/landmark';

const WATCHTOWER: Landmark = {
  id: 'watchtower-1',
  name: 'North Tower',
  ownerId: 'player-1',
  coordinate: { q: 0, r: 0 },
  type: 'WATCHTOWER',
};

const TINT_COLOR = new THREE.Color(0x3498db);

describe('WatchtowerRenderer', () => {
  const renderer = new WatchtowerRenderer();

  it('builds a group containing shaft, platform, window bar lines, and roof', () => {
    const group = renderer.build(WATCHTOWER, 0, TINT_COLOR);
    expect(group).toBeInstanceOf(THREE.Group);

    const meshes: THREE.Mesh[] = [];
    const lineSegments: THREE.LineSegments[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
      if ((child as THREE.LineSegments).isLineSegments) {
        lineSegments.push(child as THREE.LineSegments);
      }
    });

    // Shaft (1) + Platform (1) + Roof (1) = 3 solid meshes minimum (plus name plane)
    expect(meshes.length).toBeGreaterThanOrEqual(3);

    // Should include line segments for edges and window bars
    expect(lineSegments.length).toBeGreaterThanOrEqual(4);
  });

  it('renders vertical window bar lines connecting platform edges to roof edges', () => {
    const group = renderer.build(WATCHTOWER, 0, TINT_COLOR);
    const lineSegments: THREE.LineSegments[] = [];
    group.traverse((child) => {
      if ((child as THREE.LineSegments).isLineSegments) {
        lineSegments.push(child as THREE.LineSegments);
      }
    });

    // Find the window bars line segment with 6 line pairs (12 vertices = 36 coordinates)
    const windowBars = lineSegments.find(
      (ls) => ls.geometry.attributes.position && ls.geometry.attributes.position.count === 12
    );
    expect(windowBars).toBeDefined();

    const pos = windowBars!.geometry.attributes.position;
    for (let i = 0; i < 12; i += 2) {
      // Bottom vertex on platform top (y = 1.12)
      expect(pos.getY(i)).toBeCloseTo(1.12);
      // Top vertex on roof underside (y = 1.48)
      expect(pos.getY(i + 1)).toBeCloseTo(1.48);
      // X and Z coordinates match between bottom and top of each bar
      expect(pos.getX(i)).toBeCloseTo(pos.getX(i + 1));
      expect(pos.getZ(i)).toBeCloseTo(pos.getZ(i + 1));
    }
  });

  it('elevates top roof above eye height so camera is under the top roof', () => {
    const group = renderer.build(WATCHTOWER, 0, TINT_COLOR);
    const meshes: THREE.Mesh[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });

    // Find the roof mesh (the highest mesh in the tower structure)
    const maxY = Math.max(...meshes.map((m) => m.position.y));
    const eyeHeight = 1.35;

    // Roof must be above eye height so the camera is positioned under the top roof
    expect(maxY).toBeGreaterThan(eyeHeight);
  });
});
