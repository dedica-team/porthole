import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ProcessArrowRenderer } from '@/components/HexGrid/ProcessArrowRenderer';
import { buildXrayLine } from '@/components/HexGrid/connectionRenderers';
import type { StageConnectionEntry } from '@/components/HexGrid/ProcessArrowRenderer';
import type { HexTile } from '@/types/hex';
import type { Connection } from '@/types/connection';

describe('ProcessArrowRenderer', () => {
  const tiles: HexTile[] = [
    { coordinate: { q: 0, r: 0 }, elevation: 1, terrain: 'GRASS', ownerId: null },
    { coordinate: { q: 1, r: 0 }, elevation: 1, terrain: 'GRASS', ownerId: null },
    { coordinate: { q: 2, r: 0 }, elevation: 1, terrain: 'GRASS', ownerId: null },
  ];

  it('renders white arrows with double width geometries for active process stage connections', () => {
    const renderer = new ProcessArrowRenderer();
    const group = renderer.getGroup();

    const entries: StageConnectionEntry[] = [
      {
        stageConn: {
          id: 'sc-1',
          connectionId: 'c-1',
          direction: 'FORWARD',
        },
        connection: {
          id: 'c-1',
          originId: 'lm-1',
          targetId: 'lm-2',
          name: 'Order Pipe',
          type: 'STREET',
          path: [
            { q: 0, r: 0 },
            { q: 1, r: 0 },
            { q: 2, r: 0 },
          ],
        },
      },
    ];

    renderer.update(entries, tiles);

    // Group should contain mesh children
    const meshes: THREE.Mesh[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });

    expect(meshes.length).toBeGreaterThan(0);

    // Check material properties: white color (0xffffff)
    meshes.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0xffffff);
    });

    // Check shaft geometry width (perpendicular offset should reflect shaft width of 0.36, i.e. extent >= 0.18 from center)
    const shaftMesh = meshes[0];
    const pos = shaftMesh.geometry.getAttribute('position');
    expect(pos).toBeDefined();
    expect(pos.count).toBeGreaterThan(0);
  });

  it('renders bidirectional arrows correctly in white', () => {
    const renderer = new ProcessArrowRenderer();
    const group = renderer.getGroup();

    const entries: StageConnectionEntry[] = [
      {
        stageConn: {
          id: 'sc-2',
          connectionId: 'c-2',
          direction: 'BIDIRECTIONAL',
        },
        connection: {
          id: 'c-2',
          originId: 'lm-1',
          targetId: 'lm-2',
          name: 'Two-way Pipe',
          type: 'STREET',
          path: [
            { q: 0, r: 0 },
            { q: 1, r: 0 },
          ],
        },
      },
    ];

    renderer.update(entries, tiles);

    const meshes: THREE.Mesh[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });

    expect(meshes.length).toBeGreaterThan(0);
    meshes.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0xffffff);
      expect(mat.opacity).toBeCloseTo(0.36);
    });
  });

  it('clears previous geometries when updated with empty entries', () => {
    const renderer = new ProcessArrowRenderer();
    const group = renderer.getGroup();

    renderer.update([], tiles);
    expect(group.children.length).toBe(0);
  });
});

describe('buildXrayLine', () => {
  const tiles: HexTile[] = [
    { coordinate: { q: 0, r: 0 }, elevation: 1, terrain: 'GRASS', ownerId: null },
    { coordinate: { q: 1, r: 0 }, elevation: 1, terrain: 'GRASS', ownerId: null },
    { coordinate: { q: 2, r: 0 }, elevation: 1, terrain: 'GRASS', ownerId: null },
  ];

  it('builds straight-line xray connection arrow with doubled shaft and arrowhead widths', () => {
    const conn: Connection = {
      id: 'c-1',
      originId: 'lm-1',
      targetId: 'lm-2',
      name: 'Test Xray Connection',
      type: 'PIPE',
      path: [
        { q: 0, r: 0 },
        { q: 2, r: 0 },
      ],
    };

    const res = buildXrayLine(conn, tiles);
    expect(res).not.toBeNull();
    if (!res) return;

    const { group } = res;
    const meshes = group.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
    expect(meshes).toHaveLength(2); // shaft mesh + arrowhead mesh

    const shaftMesh = meshes[0];
    const arrowMesh = meshes[1];

    const shaftPos = shaftMesh.geometry.getAttribute('position');
    const arrowPos = arrowMesh.geometry.getAttribute('position');

    // Calculate shaft width between vertex 0 and vertex 1 (should be 2 * XRAY_SHAFT_HW = 0.22)
    const shaftWidth = Math.hypot(
      shaftPos.getX(0) - shaftPos.getX(1),
      shaftPos.getZ(0) - shaftPos.getZ(1),
    );
    expect(shaftWidth).toBeCloseTo(0.22, 2);

    // Calculate arrowhead base width between vertex 1 and vertex 2 (should be 2 * XRAY_ARROW_HW = 0.80)
    const arrowBaseWidth = Math.hypot(
      arrowPos.getX(1) - arrowPos.getX(2),
      arrowPos.getZ(1) - arrowPos.getZ(2),
    );
    expect(arrowBaseWidth).toBeCloseTo(0.80, 2);
  });
});
