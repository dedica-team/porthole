import { describe, expect, it } from 'vitest';

import { createTileRenderKey } from '@/components/HexGrid/tileRenderKey';
import type { HexTile } from '@/types/hex';

function makeTile(
  q: number,
  r: number,
  elevation: number,
  terrain: HexTile['terrain'],
): HexTile {
  return {
    coordinate: { q, r },
    elevation,
    terrain,
  };
}

describe('createTileRenderKey', () => {
  it('stays stable for equivalent tile objects', () => {
    const a = [makeTile(0, 0, 2, 'FOREST')];
    const b = [makeTile(0, 0, 2, 'FOREST')];

    expect(createTileRenderKey(a)).toBe(createTileRenderKey(b));
  });

  it('changes when elevation changes', () => {
    const a = [makeTile(0, 0, 2, 'FOREST')];
    const b = [makeTile(0, 0, 3, 'FOREST')];

    expect(createTileRenderKey(a)).not.toBe(createTileRenderKey(b));
  });

  it('changes when terrain changes', () => {
    const a = [makeTile(0, 0, 2, 'FOREST')];
    const b = [makeTile(0, 0, 2, 'ROCKS')];

    expect(createTileRenderKey(a)).not.toBe(createTileRenderKey(b));
  });

  it('keeps tile order significant for merged geometry users', () => {
    const a = [
      makeTile(0, 0, 2, 'FOREST'),
      makeTile(1, 0, 1, 'GRASS'),
    ];
    const b = [...a].reverse();

    expect(createTileRenderKey(a)).not.toBe(createTileRenderKey(b));
  });
});

