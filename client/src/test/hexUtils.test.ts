import { describe, it, expect } from 'vitest';
import { hexToWorld, hexDistance } from '../utils/hexUtils';
import { getLandmarkColor } from '@/components/HexGrid/landmarks';

describe('hexToWorld', () => {
  it('returns origin for (0, 0)', () => {
    const { x, z } = hexToWorld(0, 0);
    expect(x).toBe(0);
    expect(z).toBe(0);
  });

  it('offsets correctly for q=1, r=0', () => {
    const { x, z } = hexToWorld(1, 0);
    expect(x).toBeCloseTo(1.5);
    expect(z).toBeCloseTo(Math.sqrt(3) / 2);
  });

  it('respects the size parameter', () => {
    const { x } = hexToWorld(1, 0, 2);
    expect(x).toBeCloseTo(3);
  });
});

describe('hexDistance', () => {
  it('returns 0 for the same coordinate', () => {
    expect(hexDistance(0, 0, 0, 0)).toBe(0);
    expect(hexDistance(3, -2, 3, -2)).toBe(0);
  });

  it('returns 1 for adjacent hexes', () => {
    const adjacent = [
      [1, 0], [1, -1], [0, -1],
      [-1, 0], [-1, 1], [0, 1],
    ];
    for (const [q, r] of adjacent) {
      expect(hexDistance(0, 0, q, r)).toBe(1);
    }
  });

  it('returns 2 for distance-2 hexes', () => {
    const dist2 = [
      [2, 0], [2, -1], [2, -2],
      [1, 1], [1, -2], [0, 2],
      [0, -2], [-1, 2], [-1, -1],
      [-2, 2], [-2, 1], [-2, 0],
    ];
    for (const [q, r] of dist2) {
      expect(hexDistance(0, 0, q, r)).toBe(2);
    }
  });

  it('returns 3 or more for distant hexes', () => {
    expect(hexDistance(0, 0, 3, 0)).toBe(3);
    expect(hexDistance(0, 0, 2, 1)).toBe(3);
    expect(hexDistance(-2, 3, 2, -1)).toBe(4);
  });
});


describe('getLandmarkColor', () => {
  it('returns distinct colors for different types', () => {
    const types = ['KEEP', 'LIGHTHOUSE', 'RUINS', 'SILO', 'FURNACE'] as const;
    const colors = types.map(getLandmarkColor);
    expect(new Set(colors).size).toBe(types.length);
  });
});


