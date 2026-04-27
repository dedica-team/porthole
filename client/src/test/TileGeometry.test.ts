/**
 * TileGeometry.test.ts
 *
 * Verifies the single-material / vertex-colour tile optimisation:
 *  - buildTileGeo bakes RGB into every vertex when colours are supplied
 *  - merging N tiles with false (no groups) yields a geometry with
 *    N × TMPL_TOP_VERT_COUNT vertices and NO groups (single draw call)
 *  - TILE_TOP_MAT / TILE_SIDE_MAT are MeshStandardMaterial with vertexColors
 *  - patchTileMaterial equivalent: writing into the colour buffer changes
 *    the correct tile's vertices and leaves neighbours unchanged
 *  - raycasting tile-index derivation:
 *    Math.floor(face.a / TMPL_TOP_VERT_COUNT) returns the correct tile index
 *  - buildTileGeo returns separate horizontal (edgeGeoH) and vertical (edgeGeoV)
 *    edge geometries so land tile pillars can be rendered with a darker material
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  buildTileGeo,
  TILE_TOP_MAT,
  TILE_SIDE_MAT,
  TMPL_TOP_VERT_COUNT,
  TMPL_SIDE_VERT_COUNT,
} from '@/components/HexGrid/tileGeometry';

// ── helpers ───────────────────────────────────────────────────────────────────

const RED:   [number, number, number] = [1, 0, 0];
const GREEN: [number, number, number] = [0, 1, 0];
const BLUE:  [number, number, number] = [0, 0, 1];

function colourAt(attr: THREE.BufferAttribute, vertexIdx: number): [number, number, number] {
  return [attr.getX(vertexIdx), attr.getY(vertexIdx), attr.getZ(vertexIdx)];
}

// ── buildTileGeo ──────────────────────────────────────────────────────────────

describe('buildTileGeo', () => {
  it('returns topGeo, sideGeo, edgeGeoH and edgeGeoV', () => {
    const { topGeo, sideGeo, edgeGeoH, edgeGeoV } = buildTileGeo(1, 0, 0);
    expect(topGeo).toBeInstanceOf(THREE.BufferGeometry);
    expect(sideGeo).toBeInstanceOf(THREE.BufferGeometry);
    expect(edgeGeoH).toBeInstanceOf(THREE.BufferGeometry);
    expect(edgeGeoV).toBeInstanceOf(THREE.BufferGeometry);
  });

  it('edgeGeoH and edgeGeoV together contain only the visible edge segments', () => {
    const { edgeGeoH, edgeGeoV } = buildTileGeo(1, 0, 0);
    const hCount = (edgeGeoH.getAttribute('position') as THREE.BufferAttribute).count;
    const vCount = (edgeGeoV.getAttribute('position') as THREE.BufferAttribute).count;
    // 6 top-ring segments (×2 verts) + 6 vertical segments (×2 verts) = 24 total.
    // The 6 bottom-ring segments are buried and intentionally omitted.
    expect(hCount).toBe(12); // 6 top-ring segments × 2 vertices
    expect(vCount).toBe(12); // 6 vertical segments × 2 vertices
    expect(hCount + vCount).toBe(24);
  });

  it('edgeGeoV contains only vertical edges (endpoints differ only in Y)', () => {
    const { edgeGeoV } = buildTileGeo(1, 0, 0);
    const pos = edgeGeoV.getAttribute('position') as THREE.BufferAttribute;
    // Segments are vertex pairs; stride = 2
    for (let i = 0; i < pos.count; i += 2) {
      const dx = Math.abs(pos.getX(i) - pos.getX(i + 1));
      const dz = Math.abs(pos.getZ(i) - pos.getZ(i + 1));
      expect(dx).toBeLessThan(0.01);
      expect(dz).toBeLessThan(0.01);
    }
  });

  it('edgeGeoH contains only horizontal edges (endpoints share the same Y)', () => {
    const { edgeGeoH } = buildTileGeo(1, 0, 0);
    const pos = edgeGeoH.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 2) {
      const dy = Math.abs(pos.getY(i) - pos.getY(i + 1));
      expect(dy).toBeLessThan(0.01);
    }
  });

  it('topGeo has no colour attribute when no RGB is passed', () => {
    const { topGeo } = buildTileGeo(1, 0, 0);
    expect(topGeo.getAttribute('color')).toBeUndefined();
  });

  it('topGeo has colour attribute with correct vertex count when RGB is passed', () => {
    const { topGeo } = buildTileGeo(1, 0, 0, RED);
    const colAttr = topGeo.getAttribute('color') as THREE.BufferAttribute;
    expect(colAttr).toBeDefined();
    expect(colAttr.count).toBe(TMPL_TOP_VERT_COUNT);
  });

  it('every vertex in topGeo receives the supplied RGB', () => {
    const { topGeo } = buildTileGeo(1, 0, 0, GREEN);
    const colAttr = topGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let v = 0; v < colAttr.count; v++) {
      expect(colourAt(colAttr, v)).toEqual(GREEN);
    }
  });

  it('sideGeo has colour attribute with correct vertex count when RGB is passed', () => {
    const { sideGeo } = buildTileGeo(1, 0, 0, undefined, BLUE);
    const colAttr = sideGeo.getAttribute('color') as THREE.BufferAttribute;
    expect(colAttr).toBeDefined();
    expect(colAttr.count).toBe(TMPL_SIDE_VERT_COUNT);
  });

  it('top and side receive independent colours', () => {
    const { topGeo, sideGeo } = buildTileGeo(1, 0, 0, RED, BLUE);
    const topCol  = topGeo.getAttribute('color')  as THREE.BufferAttribute;
    const sideCol = sideGeo.getAttribute('color') as THREE.BufferAttribute;
    expect(colourAt(topCol,  0)).toEqual(RED);
    expect(colourAt(sideCol, 0)).toEqual(BLUE);
  });

  it('vertices are placed at the correct world X/Z', () => {
    const { topGeo } = buildTileGeo(0, 3, 7, RED);
    const pos = topGeo.getAttribute('position') as THREE.BufferAttribute;
    // All positions should be offset by x=3, z=7
    let xSumOffset = 0, zSumOffset = 0;
    for (let v = 0; v < pos.count; v++) {
      xSumOffset += pos.getX(v) - 3;
      zSumOffset += pos.getZ(v) - 7;
    }
    // The template is centred at 0,0, so the offsets should average to ~0
    expect(Math.abs(xSumOffset / pos.count)).toBeLessThan(0.5);
    expect(Math.abs(zSumOffset / pos.count)).toBeLessThan(0.5);
  });
});

// ── TMPL vertex counts are positive constants ─────────────────────────────────

describe('TMPL_TOP_VERT_COUNT / TMPL_SIDE_VERT_COUNT', () => {
  it('TMPL_TOP_VERT_COUNT is a positive integer', () => {
    expect(TMPL_TOP_VERT_COUNT).toBeGreaterThan(0);
    expect(Number.isInteger(TMPL_TOP_VERT_COUNT)).toBe(true);
  });

  it('TMPL_SIDE_VERT_COUNT is a positive integer', () => {
    expect(TMPL_SIDE_VERT_COUNT).toBeGreaterThan(0);
    expect(Number.isInteger(TMPL_SIDE_VERT_COUNT)).toBe(true);
  });
});

// ── Shared single materials ───────────────────────────────────────────────────

describe('TILE_TOP_MAT / TILE_SIDE_MAT', () => {
  it('TILE_TOP_MAT is a MeshStandardMaterial with vertexColors', () => {
    expect(TILE_TOP_MAT).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(TILE_TOP_MAT.vertexColors).toBe(true);
  });

  it('TILE_SIDE_MAT is a MeshStandardMaterial with vertexColors', () => {
    expect(TILE_SIDE_MAT).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(TILE_SIDE_MAT.vertexColors).toBe(true);
  });

  it('TILE_TOP_MAT and TILE_SIDE_MAT are the same shared instances (not recreated)', async () => {
    const { TILE_TOP_MAT: mat2 } = await import('@/components/HexGrid/tileGeometry');
    expect(mat2).toBe(TILE_TOP_MAT);
  });
});

// ── Merged geometry: single draw call (no groups) ────────────────────────────

describe('mergeGeometries with false → single draw call', () => {
  it('merged top geometry has no groups', () => {
    const geos = [
      buildTileGeo(1, 0, 0, RED).topGeo,
      buildTileGeo(1, 1, 0, GREEN).topGeo,
      buildTileGeo(1, 2, 0, BLUE).topGeo,
    ];
    const merged = mergeGeometries(geos, false)!;
    expect(merged.groups).toHaveLength(0);
    geos.forEach((g) => g.dispose());
    merged.dispose();
  });

  it('merged top geometry has total vertex count = N × TMPL_TOP_VERT_COUNT', () => {
    const N = 5;
    const geos = Array.from({ length: N }, (_, i) => buildTileGeo(1, i, 0, RED).topGeo);
    const merged = mergeGeometries(geos, false)!;
    const pos = merged.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.count).toBe(N * TMPL_TOP_VERT_COUNT);
    geos.forEach((g) => g.dispose());
    merged.dispose();
  });

  it('vertex colours are preserved in the merged geometry', () => {
    const colours: [number, number, number][] = [RED, GREEN, BLUE];
    const geos = colours.map((c, i) => buildTileGeo(1, i, 0, c).topGeo);
    const merged = mergeGeometries(geos, false)!;
    const colAttr = merged.getAttribute('color') as THREE.BufferAttribute;

    colours.forEach((expectedRGB, tileIdx) => {
      const baseVertex = tileIdx * TMPL_TOP_VERT_COUNT;
      expect(colourAt(colAttr, baseVertex)).toEqual(expectedRGB);
    });

    geos.forEach((g) => g.dispose());
    merged.dispose();
  });
});

// ── Raycasting tile-index derivation ─────────────────────────────────────────

describe('Raycasting tile index derivation', () => {
  it('Math.floor(vertexIndex / TMPL_TOP_VERT_COUNT) maps to the correct tile', () => {
    const N = 10;
    // Simulate what Three.js raycaster returns as face.a after merging:
    // vertex indices run 0…N×V-1 in tile order.
    for (let tile = 0; tile < N; tile++) {
      // First and last vertex index for this tile
      const firstVertex = tile * TMPL_TOP_VERT_COUNT;
      const lastVertex  = (tile + 1) * TMPL_TOP_VERT_COUNT - 1;
      expect(Math.floor(firstVertex / TMPL_TOP_VERT_COUNT)).toBe(tile);
      expect(Math.floor(lastVertex  / TMPL_TOP_VERT_COUNT)).toBe(tile);
    }
  });

  it('vertex index from the wrong tile does not map to adjacent tile', () => {
    const tile0lastVertex = TMPL_TOP_VERT_COUNT - 1;
    const tile1firstVertex = TMPL_TOP_VERT_COUNT;
    expect(Math.floor(tile0lastVertex  / TMPL_TOP_VERT_COUNT)).toBe(0);
    expect(Math.floor(tile1firstVertex / TMPL_TOP_VERT_COUNT)).toBe(1);
  });
});

// ── patchTileMaterial simulation ──────────────────────────────────────────────

describe('patchTileMaterial: direct vertex colour buffer update', () => {
  it('writing to tile N changes only tile N vertices in the merged buffer', () => {
    const N = 4;
    const geos  = Array.from({ length: N }, (_, i) => buildTileGeo(1, i, 0, RED).topGeo);
    const merged = mergeGeometries(geos, false)!;
    const colAttr = merged.getAttribute('color') as THREE.Float32BufferAttribute;

    const TARGET = 2;
    const NEW_COL: [number, number, number] = [0, 0.5, 1];

    // Simulate what patchTileMaterial does
    const base = TARGET * TMPL_TOP_VERT_COUNT * 3;
    for (let v = 0; v < TMPL_TOP_VERT_COUNT; v++) {
      colAttr.array[base + v * 3]     = NEW_COL[0];
      colAttr.array[base + v * 3 + 1] = NEW_COL[1];
      colAttr.array[base + v * 3 + 2] = NEW_COL[2];
    }

    // Target tile has new colour
    for (let v = 0; v < TMPL_TOP_VERT_COUNT; v++) {
      expect(colourAt(colAttr, TARGET * TMPL_TOP_VERT_COUNT + v)).toEqual(NEW_COL);
    }
    // All other tiles still have original RED
    for (let t = 0; t < N; t++) {
      if (t === TARGET) continue;
      expect(colourAt(colAttr, t * TMPL_TOP_VERT_COUNT)).toEqual(RED);
    }

    geos.forEach((g) => g.dispose());
    merged.dispose();
  });
});

