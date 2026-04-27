/**
 * Tests for the WALL landmark type:
 *  - WallRenderer geometry / tie-breaker logic
 *  - getLandmarkColor / getLandmarkRenderer registry includes WALL
 *  - map.ts type definitions include WALL
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  WallRenderer,
  getLandmarkRenderer,
  getLandmarkColor,
} from '@/components/HexGrid/landmarks';
import type { Adjacent } from '@/components/HexGrid/landmarks';
import type { HexTile, Landmark } from '../types/map';
import { ALL_LANDMARK_TYPES, LANDMARK_TYPE_LABELS } from '../types/map';

// ── helpers ───────────────────────────────────────────────────────────────────

const WALL_LANDMARK: Landmark = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'North Wall',
  ownerId: 'player-1',
  coordinate: { q: 0, r: 0 },
  type: 'WALL',
};

const EDGE_COLOR = new THREE.Color(0xe74c3c);

/** Count all THREE.Mesh objects recursively in a group. */
function meshCountDeep(g: THREE.Group): number {
  let n = 0;
  g.traverse((c) => { if ((c as THREE.Mesh).isMesh) n++; });
  return n;
}

/** Count THREE.LineSegments recursively (edge wireframes). */
function lineSegmentCountDeep(g: THREE.Group): number {
  let n = 0;
  g.traverse((c) => { if ((c as THREE.LineSegments).isLineSegments) n++; });
  return n;
}


function makeDir(x: number, y: number, len = 1.5): THREE.Vector2 {
  const v = new THREE.Vector2(x, y).normalize();
  (v as unknown as { _len: number })._len = len;
  return v;
}

function makeWallLandmark(): Landmark {
  return { ...WALL_LANDMARK, id: crypto.randomUUID() };
}

function makeHexTile(elevation: number): HexTile {
  return { coordinate: { q: 0, r: 0 }, elevation, terrain: 'GRASS', ownerId: null };
}

function owned(x: number, y: number, neighbourElevation = 1): Adjacent {
  return { dir: makeDir(x, y), landmark: makeWallLandmark(), hexTile: makeHexTile(neighbourElevation) };
}

function unowned(x: number, y: number, neighbourElevation = 1): Adjacent {
  return { dir: makeDir(x, y), landmark: null, hexTile: makeHexTile(neighbourElevation) };
}

/** Collect all MeshLambertMaterial meshes (the cyan rails) from a group. */
function getCyanMeshes(g: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  g.traverse((c) => {
    if ((c as THREE.Mesh).isMesh && (c as THREE.Mesh).material instanceof THREE.MeshLambertMaterial)
      out.push(c as THREE.Mesh);
  });
  return out;
}

const renderer = new WallRenderer();

// ── type registry ─────────────────────────────────────────────────────────────

describe('WALL in type registry', () => {
  it('ALL_LANDMARK_TYPES includes WALL', () => {
    expect(ALL_LANDMARK_TYPES).toContain('WALL');
  });

  it('LANDMARK_TYPE_LABELS has an entry for WALL', () => {
    expect(LANDMARK_TYPE_LABELS['WALL']).toBeTruthy();
    expect(LANDMARK_TYPE_LABELS['WALL']).toMatch(/wall/i);
  });

  it('getLandmarkRenderer returns a renderer with correct color for WALL', () => {
    const renderer = getLandmarkRenderer('WALL');
    // getLandmarkRenderer returns the WallRenderer directly (statusLight is built in).
    // Verify via the exposed color property instead.
    expect(renderer.color).toBe(new WallRenderer().color);
    expect(typeof renderer.build).toBe('function');
  });

  it('getLandmarkColor returns a number for WALL', () => {
    expect(typeof getLandmarkColor('WALL')).toBe('number');
  });
});

// ── isolated wall (no neighbours) ─────────────────────────────────────────────

describe('WallRenderer – isolated (no adjacentWalls)', () => {
  const renderer = new WallRenderer();

  it('returns a THREE.Group', () => {
    const g = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR);
    expect(g).toBeInstanceOf(THREE.Group);
  });

  it('has at least 2 meshes (pillar + cap)', () => {
    const g = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR);
    expect(meshCountDeep(g)).toBeGreaterThanOrEqual(2);
  });

  it('has no wall-segment meshes beyond pillar + cap (+ cap glow overlay)', () => {
    const g = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR);
    // pillar + cap + cap glow overlay = 3 (no name label)
    expect(meshCountDeep(g)).toBe(3);
  });
});

// ── wall with adjacentWalls = [] (explicitly empty) ───────────────────────────

describe('WallRenderer – empty adjacentWalls array', () => {
  const renderer = new WallRenderer();

  it('behaves identically to no adjacentWalls arg', () => {
    const withUndefined = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, undefined);
    const withEmpty     = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, []);
    expect(meshCountDeep(withUndefined)).toBe(meshCountDeep(withEmpty));
  });
});

// ── tie-breaker: owned vs. unowned ────────────────────────────────────────────

describe('WallRenderer – tie-breaker (owned flag)', () => {
  const renderer = new WallRenderer();

  it('adds a segment mesh for an owned adjacency', () => {
    const baseline = meshCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, []));
    const withOwned = meshCountDeep(
      renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0)]),
    );
    expect(withOwned).toBeGreaterThan(baseline);
  });

  it('does NOT add a segment mesh for an unowned adjacency', () => {
    const baseline   = meshCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, []));
    const withUnowned = meshCountDeep(
      renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [unowned(1, 0)]),
    );
    expect(withUnowned).toBe(baseline);
  });

  it('adds one segment per owned adjacency', () => {
    const baseline = meshCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, []));

    const one = meshCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0)]));
    const two = meshCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0), owned(-1, 0)]));

    const delta1 = one - baseline;
    const delta2 = two - baseline;
    expect(delta2).toBe(delta1 * 2);
  });

  it('ignores unowned entries mixed with owned ones', () => {
    const oneOwned   = meshCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0)]));
    const mixedExtra = meshCountDeep(
      renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0), unowned(-1, 0)]),
    );
    expect(mixedExtra).toBe(oneOwned);
  });
});


// ── rail count and geometry ───────────────────────────────────────────────────

describe('WallRenderer – rail geometry', () => {
  const renderer = new WallRenderer();

  it('adds 6 rail meshes per owned adjacency (3 Lambert + 3 laser overlay)', () => {
    const baseline = meshCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, []));
    const withOne  = meshCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0)]));
    expect(withOne - baseline).toBe(6);
  });

  it('each rail spans from z=0 to z=len in local space', () => {
    const LEN = 1.5;
    const g = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0, 1)]);

    const rails = getCyanMeshes(g);
    expect(rails.length).toBe(3);

    for (const r of rails) {
      const pos = r.geometry.attributes.position;
      const zVals = Array.from({ length: pos.count }, (_, i) => pos.getZ(i));
      expect(Math.min(...zVals)).toBeCloseTo(0, 4);
      expect(Math.max(...zVals)).toBeCloseTo(LEN, 4);
    }
  });

  it('rails are stacked at different Y positions', () => {
    const g = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0)]);
    const rails = getCyanMeshes(g);
    const yBases = rails.map((r) => r.geometry.attributes.position.getY(0));
    // All three near-bottom Y values must be distinct
    expect(new Set(yBases.map((y) => y.toFixed(3))).size).toBe(3);
  });
});

// ── segment colour is TRON_CYAN ───────────────────────────────────────────────

describe('WallRenderer – rail colour', () => {
  const renderer = new WallRenderer();

  it('rail colour matches TRON_CYAN (0x00f0ff)', () => {
    const CYAN = new THREE.Color(0x00f0ff);
    const g = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0)]);
    const rails = getCyanMeshes(g);
    expect(rails.length).toBeGreaterThan(0);
    for (const r of rails) {
      const c = (r.material as THREE.MeshLambertMaterial).color;
      expect(c.r).toBeCloseTo(CYAN.r, 2);
      expect(c.g).toBeCloseTo(CYAN.g, 2);
      expect(c.b).toBeCloseTo(CYAN.b, 2);
    }
  });

  it('rails are translucent (opacity < 1)', () => {
    const g = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0)]);
    for (const r of getCyanMeshes(g)) {
      expect((r.material as THREE.MeshLambertMaterial).opacity).toBeLessThan(1);
    }
  });

  it('pillar colour differs from rail colour', () => {
    const g = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0)]);
    const meshes: THREE.Mesh[] = [];
    g.traverse((c) => { if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh); });
    // pillar is a MeshToonMaterial; rails are MeshLambertMaterial
    const pillar = meshes.find((m) => (m.material as THREE.Material).type === 'MeshToonMaterial')!;
    const rail   = meshes.find((m) => (m.material as THREE.Material).type === 'MeshLambertMaterial')!;
    expect(pillar).toBeDefined();
    expect(rail).toBeDefined();
    const pc = (pillar.material as THREE.MeshToonMaterial).color;
    const rc = (rail.material   as THREE.MeshLambertMaterial).color;
    const diff = Math.abs(pc.r - rc.r) + Math.abs(pc.g - rc.g) + Math.abs(pc.b - rc.b);
    expect(diff).toBeGreaterThan(0.05);
  });
});

// ── elevation-aware rails ─────────────────────────────────────────────────────

describe('WallRenderer – elevation-aware rails', () => {
  it('flat terrain: far-end Y equals near-end Y for every rail', () => {
    const g = renderer.build(WALL_LANDMARK, 2, EDGE_COLOR, [owned(1, 0, 2)]);
    for (const r of getCyanMeshes(g)) {
      const pos   = r.geometry.attributes.position;
      const yNear = pos.getY(0); // vertex 0: near bottom-left
      const yFar  = pos.getY(4); // vertex 4: far  bottom-left
      expect(yFar).toBeCloseTo(yNear, 4);
    }
  });

  it('higher neighbour: far-end Y is above near-end Y for every rail', () => {
    const g = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0, 4)]);
    for (const r of getCyanMeshes(g)) {
      const pos = r.geometry.attributes.position;
      expect(pos.getY(4)).toBeGreaterThan(pos.getY(0));
    }
  });

  it('lower neighbour: far-end Y is below near-end Y for every rail', () => {
    const g = renderer.build(WALL_LANDMARK, 4, EDGE_COLOR, [owned(1, 0, 1)]);
    for (const r of getCyanMeshes(g)) {
      const pos = r.geometry.attributes.position;
      expect(pos.getY(4)).toBeLessThan(pos.getY(0));
    }
  });
});

// ── no rail wireframes (pillar/cap edges are intentional) ────────────────────

describe('WallRenderer – no edge wireframe lines on rails', () => {
  const renderer = new WallRenderer();

  it('isolated wall has exactly 2 LineSegments (pillar + cap edges)', () => {
    const g = renderer.build(WALL_LANDMARK, 1, EDGE_COLOR);
    expect(lineSegmentCountDeep(g)).toBe(2);
  });

  it('adding owned segments does NOT add more LineSegments (no wireframe rails)', () => {
    const baseline = lineSegmentCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, []));
    const withOne  = lineSegmentCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0)]));
    expect(withOne).toBe(baseline);
  });

  it('multiple owned segments still produce no extra LineSegments', () => {
    const baseline = lineSegmentCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, []));
    const withTwo  = lineSegmentCountDeep(renderer.build(WALL_LANDMARK, 1, EDGE_COLOR, [owned(1, 0), owned(-1, 0)]));
    expect(withTwo).toBe(baseline);
  });
});

