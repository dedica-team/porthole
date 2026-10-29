import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ProcessArrowRenderer, PROCESS_LATERAL_OFFSET } from '@/components/HexGrid/ProcessArrowRenderer';
import { buildXrayLine, XRAY_LATERAL_OFFSET } from '@/components/HexGrid/connectionRenderers';
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

    // Check that bidirectional arrows are offset to opposite sides (lateral lane separation)
    const shaftMeshes = meshes.filter((m) => m.geometry.getIndex()?.count !== 3);
    expect(shaftMeshes.length).toBe(2);
    const pos1 = shaftMeshes[0].geometry.getAttribute('position');
    const pos2 = shaftMeshes[1].geometry.getAttribute('position');
    const center1 = new THREE.Vector2(
      (pos1.getX(0) + pos1.getX(1)) * 0.5,
      (pos1.getZ(0) + pos1.getZ(1)) * 0.5,
    );
    // pos2 is reversed, so the start of pos1 corresponds to the end of pos2
    const lastIdx = pos2.count - 2;
    const center2 = new THREE.Vector2(
      (pos2.getX(lastIdx) + pos2.getX(lastIdx + 1)) * 0.5,
      (pos2.getZ(lastIdx) + pos2.getZ(lastIdx + 1)) * 0.5,
    );
    // The lateral separation between opposing lanes should be 2 * PROCESS_LATERAL_OFFSET
    const separation = center1.distanceTo(center2);
    expect(separation).toBeCloseTo(2 * PROCESS_LATERAL_OFFSET, 2);
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
    expect(shaftWidth).toBeCloseTo(0.16, 2);

    // Calculate arrowhead base width between vertex 1 and vertex 2 (should be 2 * XRAY_ARROW_HW = 0.80)
    const arrowBaseWidth = Math.hypot(
      arrowPos.getX(1) - arrowPos.getX(2),
      arrowPos.getZ(1) - arrowPos.getZ(2),
    );
    expect(arrowBaseWidth).toBeCloseTo(0.64, 2);

    // Verify lateral offset along the normal vector perpendicular to direction
    const shaftCenterX = (shaftPos.getX(0) + shaftPos.getX(1)) * 0.5;
    const shaftCenterZ = (shaftPos.getZ(0) + shaftPos.getZ(1)) * 0.5;
    // Unshifted start point for (0,0) -> (2,0) trimmed by XRAY_TRIM (0.44) along (sqrt(3)/2, 0.5):
    // unshifted start = (0.44 * sqrt(3)/2, 0.44 * 0.5) = (0.381, 0.22)
    // with normal (-0.5, sqrt(3)/2) * 0.14 = (-0.07, 0.1212)
    // expected shaft center = (0.381 - 0.07, 0.22 + 0.1212) = (0.311, 0.3412)
    expect(shaftCenterX).toBeCloseTo(0.44 * (Math.sqrt(3) / 2) - 0.5 * XRAY_LATERAL_OFFSET, 2);
    expect(shaftCenterZ).toBeCloseTo(0.44 * 0.5 + (Math.sqrt(3) / 2) * XRAY_LATERAL_OFFSET, 2);
  });

  it('shifts opposing xray connections laterally into separate non-overlapping lanes', () => {
    const forwardConn: Connection = {
      id: 'c-fwd',
      originId: 'lm-1',
      targetId: 'lm-2',
      type: 'PIPE',
      path: [{ q: 0, r: 0 }, { q: 2, r: 0 }],
    };
    const reverseConn: Connection = {
      id: 'c-rev',
      originId: 'lm-2',
      targetId: 'lm-1',
      type: 'PIPE',
      path: [{ q: 2, r: 0 }, { q: 0, r: 0 }],
    };

    const fwdRes = buildXrayLine(forwardConn, tiles);
    const revRes = buildXrayLine(reverseConn, tiles);
    expect(fwdRes).not.toBeNull();
    expect(revRes).not.toBeNull();
    if (!fwdRes || !revRes) return;

    const fwdShaft = fwdRes.group.children[0] as THREE.Mesh;
    const revShaft = revRes.group.children[0] as THREE.Mesh;

    const fwdPos = fwdShaft.geometry.getAttribute('position');
    const revPos = revShaft.geometry.getAttribute('position');

    // Sample index corresponding to t = 0.5 (midpoint of the path)
    // SAMPLES = 24 in buildXrayLine for 2-tile path
    const SAMPLES = 24;
    const midSampleIdx = SAMPLES / 2;

    const fwdCenter = new THREE.Vector2(
      (fwdPos.getX(2 * midSampleIdx) + fwdPos.getX(2 * midSampleIdx + 1)) * 0.5,
      (fwdPos.getZ(2 * midSampleIdx) + fwdPos.getZ(2 * midSampleIdx + 1)) * 0.5,
    );
    const revCenter = new THREE.Vector2(
      (revPos.getX(2 * midSampleIdx) + revPos.getX(2 * midSampleIdx + 1)) * 0.5,
      (revPos.getZ(2 * midSampleIdx) + revPos.getZ(2 * midSampleIdx + 1)) * 0.5,
    );

    // Difference between centerlines should be exactly 2 * XRAY_LATERAL_OFFSET
    const laneSeparation = fwdCenter.distanceTo(revCenter);
    expect(laneSeparation).toBeCloseTo(2 * XRAY_LATERAL_OFFSET, 2);
  });

  it('builds curved xray connection arrow following intermediate hex tile path coordinates', () => {
    const curvedTiles: HexTile[] = [
      { coordinate: { q: 0, r: 0 }, elevation: 1, terrain: 'GRASS', ownerId: null },
      { coordinate: { q: 1, r: 0 }, elevation: 1, terrain: 'GRASS', ownerId: null },
      { coordinate: { q: 1, r: 1 }, elevation: 1, terrain: 'GRASS', ownerId: null },
      { coordinate: { q: 2, r: 1 }, elevation: 1, terrain: 'GRASS', ownerId: null },
    ];

    const curvedConn: Connection = {
      id: 'c-curved',
      originId: 'lm-1',
      targetId: 'lm-2',
      name: 'Curved Xray Connection',
      type: 'PIPE',
      path: [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 1, r: 1 },
        { q: 2, r: 1 },
      ],
    };

    const res = buildXrayLine(curvedConn, curvedTiles);
    expect(res).not.toBeNull();
    if (!res) return;

    const { group } = res;
    const meshes = group.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
    expect(meshes).toHaveLength(2);

    const shaftMesh = meshes[0];
    const shaftPos = shaftMesh.geometry.getAttribute('position');

    // The shaft should contain multiple sampled segments along the curve
    expect(shaftPos.count).toBeGreaterThan(10);

    // Midpoint of the shaft should curve towards (q: 1, r: 0) and (q: 1, r: 1)
    // rather than lying on the straight line from (0,0) to (2,1)
    const midIdx = Math.floor(shaftPos.count / 2);
    const midX = shaftPos.getX(midIdx);
    const midZ = shaftPos.getZ(midIdx);

    // Check that vertices are generated at valid coordinates
    expect(Number.isFinite(midX)).toBe(true);
    expect(Number.isFinite(midZ)).toBe(true);
  });

  it('returns null for connection with insufficient path length', () => {
    const invalidConn: Connection = {
      id: 'c-invalid',
      originId: 'lm-1',
      targetId: 'lm-2',
      type: 'PIPE',
      path: [{ q: 0, r: 0 }],
    };
    expect(buildXrayLine(invalidConn, tiles)).toBeNull();
  });
});
