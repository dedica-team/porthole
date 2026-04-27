import { describe, it, expect } from 'vitest';
import { hexToWorld } from '../utils/hexUtils';
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


describe('getLandmarkColor', () => {
  it('returns distinct colors for different types', () => {
    const types = ['KEEP', 'LIGHTHOUSE', 'RUINS', 'SILO', 'FURNACE'] as const;
    const colors = types.map(getLandmarkColor);
    expect(new Set(colors).size).toBe(types.length);
  });
});


