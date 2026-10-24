import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  desaturateColor,
  resolveStatusElements,
  computeTileHeatmapColor,
  type StatusElement,
} from '@/components/HexGrid/heatmapUtils';
import type { Landmark } from '@/types/landmark';
import { QUALITY_LEVEL_COLOR } from '@/types/landmark';

describe('desaturateColor', () => {
  it('reduces saturation while keeping hue and lightness', () => {
    const originalHex = '#ef4444'; // Red
    const [r, g, b] = desaturateColor(originalHex, 0.4);

    const origColor = new THREE.Color(originalHex);
    const origHsl = { h: 0, s: 0, l: 0 };
    origColor.getHSL(origHsl);

    const desatColor = new THREE.Color(r, g, b);
    const desatHsl = { h: 0, s: 0, l: 0 };
    desatColor.getHSL(desatHsl);

    expect(desatHsl.h).toBeCloseTo(origHsl.h, 2);
    expect(desatHsl.l).toBeCloseTo(origHsl.l, 2);
    expect(desatHsl.s).toBeCloseTo(origHsl.s * 0.4, 2);
  });
});

describe('resolveStatusElements', () => {
  it('returns empty array when metricOverlayEntries is undefined ("none" overlay)', () => {
    const landmarks: Record<string, Landmark> = {
      'lm-1': {
        id: 'lm-1',
        name: 'Tower 1',
        ownerId: null,
        type: 'KEEP',
        coordinate: { q: 0, r: 0 },
        metrics: {
          'm-1': { metricId: 'm-1', level: 'ERROR' },
        },
      },
    };

    const elements = resolveStatusElements(landmarks, undefined);
    expect(elements).toEqual([]);
  });

  it('returns empty array when metricOverlayEntries is empty', () => {
    const landmarks: Record<string, Landmark> = {
      'lm-1': {
        id: 'lm-1',
        name: 'Tower 1',
        ownerId: null,
        type: 'KEEP',
        coordinate: { q: 0, r: 0 },
        metrics: {
          'm-1': { metricId: 'm-1', level: 'ERROR' },
        },
      },
    };

    const elements = resolveStatusElements(landmarks, new Map());
    expect(elements).toEqual([]);
  });

  it('respects metricOverlayEntries when a specific metric layer is selected', () => {
    const landmarks: Record<string, Landmark> = {
      'lm-1': {
        id: 'lm-1',
        name: 'Tower 1',
        ownerId: null,
        type: 'KEEP',
        coordinate: { q: 0, r: 0 },
        metrics: {
          'm-1': { metricId: 'm-1', level: 'ERROR' },
          'm-2': { metricId: 'm-2', level: 'OK' },
        },
      },
      'lm-2': {
        id: 'lm-2',
        name: 'Tower 2',
        ownerId: null,
        type: 'HOUSE',
        coordinate: { q: 5, r: 5 },
        metrics: {},
      },
    };

    const overlay = new Map([
      ['lm-1', { value: '✔', color: QUALITY_LEVEL_COLOR.OK }],
    ]);

    const elements = resolveStatusElements(landmarks, overlay);
    expect(elements.length).toBe(1);
    expect(elements[0].id).toBe('lm-1');
    expect(elements[0].coordinate).toEqual({ q: 0, r: 0 });
    const expectedColor = new THREE.Color(QUALITY_LEVEL_COLOR.OK);
    expect(elements[0].statusColor[0]).toBeCloseTo(expectedColor.r);
  });
});

describe('computeTileHeatmapColor', () => {
  const errorColor = new THREE.Color(QUALITY_LEVEL_COLOR.ERROR);
  const okColor = new THREE.Color(QUALITY_LEVEL_COLOR.OK);

  const errorElement: StatusElement = {
    id: 'lm-err',
    coordinate: { q: 0, r: 0 },
    statusColor: [errorColor.r, errorColor.g, errorColor.b],
    desaturatedColor: desaturateColor(QUALITY_LEVEL_COLOR.ERROR, 0.4),
  };

  it('paints distance 0 (element hex) and distance 1 (adjacent) in full status color', () => {
    // Distance 0
    const colorDist0 = computeTileHeatmapColor(0, 0, [errorElement]);
    expect(colorDist0).not.toBeNull();
    expect(colorDist0!.topRGB[0]).toBeCloseTo(errorElement.statusColor[0]);
    expect(colorDist0!.topRGB[1]).toBeCloseTo(errorElement.statusColor[1]);
    expect(colorDist0!.topRGB[2]).toBeCloseTo(errorElement.statusColor[2]);

    // Distance 1
    const colorDist1 = computeTileHeatmapColor(1, 0, [errorElement]);
    expect(colorDist1).not.toBeNull();
    expect(colorDist1!.topRGB[0]).toBeCloseTo(errorElement.statusColor[0]);
    expect(colorDist1!.topRGB[1]).toBeCloseTo(errorElement.statusColor[1]);
    expect(colorDist1!.topRGB[2]).toBeCloseTo(errorElement.statusColor[2]);
  });

  it('paints distance 2 in desaturated status color', () => {
    const colorDist2 = computeTileHeatmapColor(2, 0, [errorElement]);
    expect(colorDist2).not.toBeNull();
    expect(colorDist2!.topRGB[0]).toBeCloseTo(errorElement.desaturatedColor[0]);
    expect(colorDist2!.topRGB[1]).toBeCloseTo(errorElement.desaturatedColor[1]);
    expect(colorDist2!.topRGB[2]).toBeCloseTo(errorElement.desaturatedColor[2]);
  });

  it('returns null for distance 3+ (no influence)', () => {
    const colorDist3 = computeTileHeatmapColor(3, 0, [errorElement]);
    expect(colorDist3).toBeNull();
  });

  it('blends influence of multiple nearby elements according to proximity', () => {
    const okElement: StatusElement = {
      id: 'lm-ok',
      coordinate: { q: 2, r: 0 },
      statusColor: [okColor.r, okColor.g, okColor.b],
      desaturatedColor: desaturateColor(QUALITY_LEVEL_COLOR.OK, 0.4),
    };

    // Tile at (1, 0): distance 1 from lm-err (d=1, w=1), distance 1 from lm-ok (d=1, w=1)
    const midColor = computeTileHeatmapColor(1, 0, [errorElement, okElement]);
    expect(midColor).not.toBeNull();
    const expectedR = (errorElement.statusColor[0] + okElement.statusColor[0]) / 2;
    const expectedG = (errorElement.statusColor[1] + okElement.statusColor[1]) / 2;
    const expectedB = (errorElement.statusColor[2] + okElement.statusColor[2]) / 2;
    expect(midColor!.topRGB[0]).toBeCloseTo(expectedR);
    expect(midColor!.topRGB[1]).toBeCloseTo(expectedG);
    expect(midColor!.topRGB[2]).toBeCloseTo(expectedB);

    // Tile at (0, 0): distance 0 from lm-err (d=0, w=1, full error), distance 2 from lm-ok (d=2, w=0.5, desat ok)
    const errDominated = computeTileHeatmapColor(0, 0, [errorElement, okElement]);
    expect(errDominated).not.toBeNull();
    const expectedDomR = (errorElement.statusColor[0] * 1.0 + okElement.desaturatedColor[0] * 0.5) / 1.5;
    expect(errDominated!.topRGB[0]).toBeCloseTo(expectedDomR);
  });
});
