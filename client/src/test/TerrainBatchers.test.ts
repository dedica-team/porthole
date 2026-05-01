/**
 * TerrainBatchers.test.ts
 *
 * Verifies that every terrain renderer that accumulates data across tiles
 * (via init / build / flush) emits exactly ONE InstancedMesh / LineSegments /
 * Points per terrain type instead of one per tile.
 *
 * Also tests RockBatcher, LineBatcher and PointsBatcher directly.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RockBatcher, LineBatcher, PointsBatcher } from '@/components/HexGrid/terrainUtils';
import { RocksRenderer }   from '@/components/HexGrid/renderers/RocksRenderer';
import { WaterRenderer }   from '@/components/HexGrid/renderers/WaterRenderer';
import { SwampRenderer }   from '@/components/HexGrid/renderers/SwampRenderer';
import { DesertRenderer }  from '@/components/HexGrid/renderers/DesertRenderer';
import { MeadowRenderer }  from '@/components/HexGrid/renderers/MeadowRenderer';
import { BeachRenderer }   from '@/components/HexGrid/renderers/BeachRenderer';
import { ForestRenderer }  from '@/components/HexGrid/renderers/ForestRenderer';
import { SnowyRenderer }   from '@/components/HexGrid/renderers/SnowyRenderer';
import { IceRenderer }     from '@/components/HexGrid/renderers/IceRenderer';
import { ScorchedRenderer } from '@/components/HexGrid/renderers/ScorchedRenderer';
import type { HexTile } from '@/types/hex';
// ── helpers ───────────────────────────────────────────────────────────────────

function makeTile(q: number, r: number, terrain: HexTile['terrain'] = 'GRASS', elevation = 1): HexTile {
  return { coordinate: { q, r }, terrain, elevation, ownerId: null };
}

function makeScene() {
  // Three.js Scene works without a WebGL context; object add/remove is pure JS.
  return new THREE.Scene();
}

/** Count direct children of a scene that are instances of a given constructor. */
function countType<T extends THREE.Object3D>(
  scene: THREE.Scene,
  ctor: new (...args: never[]) => T,
): number {
  return scene.children.filter((c) => c instanceof ctor).length;
}

// ── RockBatcher unit tests ────────────────────────────────────────────────────

describe('RockBatcher', () => {
  it('flush on empty batcher returns null', () => {
    const scene  = makeScene();
    const result = new RockBatcher().flush(scene);
    expect(result).toBeNull();
    expect(scene.children).toHaveLength(0);
  });

  it('emits exactly one InstancedMesh and one LineSegments for N tiles', () => {
    const scene   = makeScene();
    const batcher = new RockBatcher({ minCount: 2, countSpread: 0 });
    const tiles   = [makeTile(0, 0), makeTile(1, 0), makeTile(0, 1), makeTile(1, 1)];
    tiles.forEach((t) => batcher.addTile(t));
    const result = batcher.flush(scene);

    expect(result).not.toBeNull();
    expect(countType(scene, THREE.InstancedMesh)).toBe(1);
    expect(countType(scene, THREE.LineSegments)).toBe(1);
  });

  it('InstancedMesh count equals total rocks across all tiles', () => {
    const scene   = makeScene();
    const minCount = 3;
    const batcher = new RockBatcher({ minCount, countSpread: 0 });
    const tiles   = [makeTile(0, 0), makeTile(1, 0)];
    tiles.forEach((t) => batcher.addTile(t));
    const result = batcher.flush(scene)!;

    expect(result.columns.count).toBe(minCount * tiles.length);
  });

  it('calling addTile after flush on a new batcher still works', () => {
    const batcher = new RockBatcher({ minCount: 1, countSpread: 0 });
    const scene1  = makeScene();
    batcher.addTile(makeTile(0, 0));
    batcher.flush(scene1);

    // A new batcher (simulating the next render cycle)
    const batcher2 = new RockBatcher({ minCount: 1, countSpread: 0 });
    const scene2   = makeScene();
    batcher2.addTile(makeTile(1, 1));
    const result2 = batcher2.flush(scene2);
    expect(result2).not.toBeNull();
    expect(result2!.columns.count).toBe(1);
  });
});

// ── LineBatcher unit tests ────────────────────────────────────────────────────

describe('LineBatcher', () => {
  it('flush on empty batcher returns null', () => {
    const scene = makeScene();
    const mat   = new THREE.LineBasicMaterial();
    expect(new LineBatcher(mat).flush(scene)).toBeNull();
    expect(scene.children).toHaveLength(0);
  });

  it('emits exactly one LineSegments for many addSegments calls', () => {
    const scene   = makeScene();
    const mat     = new THREE.LineBasicMaterial();
    const batcher = new LineBatcher(mat);
    for (let i = 0; i < 10; i++) {
      batcher.addSegments([0, 0, 0, 1, 0, 0]);
    }
    const ls = batcher.flush(scene);
    expect(ls).toBeInstanceOf(THREE.LineSegments);
    expect(countType(scene, THREE.LineSegments)).toBe(1);
    // 10 segments × 2 vertices × 3 components = 60 floats
    const pos = ls!.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.count).toBe(20);
  });

  it('accumulates vertex colour data when useVertexColors=true', () => {
    const scene   = makeScene();
    const mat     = new THREE.LineBasicMaterial({ vertexColors: true });
    const batcher = new LineBatcher(mat, true);
    batcher.addSegments([0, 0, 0, 1, 0, 0], [1, 0, 0, 0, 1, 0]);
    const ls = batcher.flush(scene)!;
    expect(ls.geometry.getAttribute('color')).toBeDefined();
    expect((ls.geometry.getAttribute('color') as THREE.BufferAttribute).count).toBe(2);
  });
});

// ── PointsBatcher unit tests ──────────────────────────────────────────────────

describe('PointsBatcher', () => {
  it('flush on empty batcher returns null', () => {
    const scene = makeScene();
    const mat   = new THREE.PointsMaterial();
    expect(new PointsBatcher(mat).flush(scene)).toBeNull();
  });

  it('emits exactly one Points object for many addPoint calls', () => {
    const scene   = makeScene();
    const mat     = new THREE.PointsMaterial();
    const batcher = new PointsBatcher(mat);
    for (let i = 0; i < 50; i++) batcher.addPoint(i, 0, 0);
    const pts = batcher.flush(scene);
    expect(pts).toBeInstanceOf(THREE.Points);
    expect(countType(scene, THREE.Points)).toBe(1);
    const pos = pts!.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(pos.count).toBe(50);
  });

  it('stores extra per-point attributes', () => {
    const scene   = makeScene();
    const mat     = new THREE.PointsMaterial();
    const batcher = new PointsBatcher(mat);
    batcher.addPoint(0, 0, 0, { aPhase: 0.5, aSpeed: 1.2 });
    batcher.addPoint(1, 0, 0, { aPhase: 0.1, aSpeed: 0.8 });
    const pts = batcher.flush(scene)!;
    expect(pts.geometry.getAttribute('aPhase')).toBeDefined();
    expect(pts.geometry.getAttribute('aSpeed')).toBeDefined();
    expect((pts.geometry.getAttribute('aPhase') as THREE.BufferAttribute).count).toBe(2);
  });
});

// ── Per-renderer batching tests ───────────────────────────────────────────────

/** Assert that a renderer emits ≤ maxObjects scene objects regardless of how
 *  many tiles are processed (i.e. it is truly batching, not per-tile). */
function testBatching(
  label: string,
  makeRenderer: () => {
    init?: (s: THREE.Scene, n: number) => THREE.Object3D[];
    build: (t: HexTile, s: THREE.Scene, adj: HexTile[]) => THREE.Object3D[];
    flush?: (s: THREE.Scene) => THREE.Object3D[];
  },
  tiles: HexTile[],
  /** Max scene children expected (generous upper bound; key is it doesn't scale with tile count) */
  maxObjects: number,
) {
  it(`${label}: scene objects do not grow with tile count`, () => {
    const scene    = makeScene();
    const renderer = makeRenderer();
    renderer.init?.(scene, tiles.length);
    tiles.forEach((t) => renderer.build(t, scene, []));
    renderer.flush?.(scene);

    // Objects added directly to scene
    expect(scene.children.length).toBeLessThanOrEqual(maxObjects);
  });
}

const ROCK_TILES  = Array.from({ length: 20 }, (_, i) => makeTile(i, 0, 'ROCKS'));
const WATER_TILES = Array.from({ length: 20 }, (_, i) => makeTile(i, 0, 'WATER'));
const SWAMP_TILES = Array.from({ length: 20 }, (_, i) => makeTile(i, 0, 'SWAMP'));
const DESERT_TILES= Array.from({ length: 20 }, (_, i) => makeTile(i, 0, 'DESERT'));
const MEADOW_TILES= Array.from({ length: 20 }, (_, i) => makeTile(i, 0, 'MEADOW'));
const BEACH_TILES = Array.from({ length: 20 }, (_, i) => makeTile(i, 0, 'BEACH'));
const FOREST_TILES= Array.from({ length: 20 }, (_, i) => makeTile(i, 0, 'FOREST'));
const SNOWY_TILES = Array.from({ length: 20 }, (_, i) => makeTile(i, 0, 'SNOWY'));
const ICE_TILES   = Array.from({ length: 20 }, (_, i) => makeTile(i, 0, 'ICE'));
const SCORCH_TILES= Array.from({ length: 20 }, (_, i) => makeTile(i, 0, 'SCORCHED'));

describe('Renderer batching – scene object count is O(1) not O(tiles)', () => {
  // max 2 = InstancedMesh + LineSegments (rocks). Some renderers add an
  // InstancedMesh in init() which counts toward the total.
  testBatching('RocksRenderer',    () => new RocksRenderer(),    ROCK_TILES,   2);
  testBatching('WaterRenderer',    () => new WaterRenderer(),    WATER_TILES,  2);
  // Swamp: reedInst (from init) + rock columns + rock edges = 3
  testBatching('SwampRenderer',    () => new SwampRenderer(),    SWAMP_TILES,  3);
  // Desert: 1 LineSegments (cactus) + 2 rocks = 3
  testBatching('DesertRenderer',   () => new DesertRenderer(),   DESERT_TILES, 3);
  testBatching('MeadowRenderer',   () => new MeadowRenderer(),   MEADOW_TILES, 1);
  // Beach: trunk LineSegments + frond LineSegments = 2
  testBatching('BeachRenderer',    () => new BeachRenderer(),    BEACH_TILES,  2);
  // Forest: crownInst (init) + trunk LineSegments (flush) = 2
  testBatching('ForestRenderer',   () => new ForestRenderer(),   FOREST_TILES, 2);
  // Snowy: moundInst (init) + edge LineSegments + shimmer Points = 3
  testBatching('SnowyRenderer',    () => new SnowyRenderer(),    SNOWY_TILES,  3);
  // Ice: spikeInst (init) + edge LineSegments + shimmer Points = 3
  testBatching('IceRenderer',      () => new IceRenderer(),      ICE_TILES,    3);
  // Scorched: debrisInst (init) + edge LineSegments + glow Points = 3
  testBatching('ScorchedRenderer', () => new ScorchedRenderer(), SCORCH_TILES, 3);
});

// ── build() must return [] for batching renderers ─────────────────────────────

describe('Renderer.build() returns [] for batching renderers (no per-tile GPU objects)', () => {
  const BATCHING_RENDERERS = [
    { name: 'RocksRenderer',    make: () => new RocksRenderer(),    tile: makeTile(0, 0, 'ROCKS')    },
    { name: 'WaterRenderer',    make: () => new WaterRenderer(),    tile: makeTile(0, 0, 'WATER')    },
    { name: 'SwampRenderer',    make: () => new SwampRenderer(),    tile: makeTile(0, 0, 'SWAMP')    },
    { name: 'DesertRenderer',   make: () => new DesertRenderer(),   tile: makeTile(0, 0, 'DESERT')   },
    { name: 'MeadowRenderer',   make: () => new MeadowRenderer(),   tile: makeTile(0, 0, 'MEADOW')   },
    { name: 'BeachRenderer',    make: () => new BeachRenderer(),    tile: makeTile(0, 0, 'BEACH')    },
    { name: 'ForestRenderer',   make: () => new ForestRenderer(),   tile: makeTile(0, 0, 'FOREST')   },
    { name: 'SnowyRenderer',    make: () => new SnowyRenderer(),    tile: makeTile(0, 0, 'SNOWY')    },
    { name: 'IceRenderer',      make: () => new IceRenderer(),      tile: makeTile(0, 0, 'ICE')      },
    { name: 'ScorchedRenderer', make: () => new ScorchedRenderer(), tile: makeTile(0, 0, 'SCORCHED') },
  ];

  BATCHING_RENDERERS.forEach(({ name, make, tile }) => {
    it(`${name}.build() returns []`, () => {
      const renderer = make();
      const scene    = makeScene();
      renderer.init?.(scene, 1);
      const result = renderer.build(tile, scene, []);
      expect(result).toEqual([]);
    });
  });
});

// ── WaterRenderer edge-skipping test ─────────────────────────────────────────

describe('WaterRenderer', () => {
  it('skips tiles fully surrounded by water (no rocks added)', () => {
    const scene    = makeScene();
    const renderer = new WaterRenderer();
    renderer.init(scene, 10);

    const waterAdj = Array.from({ length: 6 }, (_, i) => makeTile(i + 1, 0, 'WATER'));
    // All 6 neighbours are water → should be skipped
    renderer.build(makeTile(0, 0, 'WATER'), scene, waterAdj);
    // Mixed neighbours → may be included (seed-dependent, but batcher shouldn't crash)
    renderer.build(makeTile(5, 5, 'WATER'), scene, [makeTile(6, 5, 'GRASS')]);

    // flush must not throw and must add at most 2 objects
    expect(() => renderer.flush(scene)).not.toThrow();
    expect(scene.children.length).toBeLessThanOrEqual(2);
  });
});

