/**
 * Unit tests for the metric overlay layer feature.
 *
 * The CSS2D rendering lives inside HexGrid (Three.js, not JSDOM-testable), so
 * we test the pure data-transformation logic that feeds it:
 *
 *   metricOverlayEntries = buildMetricOverlayEntries(selectedMetricId, landmarks)
 *
 * This mirrors exactly what the useMemo in ProcessMapView computes.
 */
import { describe, it, expect } from 'vitest';
import { QUALITY_LEVEL_COLOR, QUALITY_LEVEL_SIGN } from '../types/landmark';
import type { Landmark, QualityLevel } from '../types/landmark';
// ── Replicate the memo logic as a pure function ───────────────────────────────

interface OverlayEntry { value: string; color: string }

function buildMetricOverlayEntries(
  selectedMetricId: string | null,
  landmarks: Record<string, Landmark>,
): Map<string, OverlayEntry> | undefined {
  if (!selectedMetricId) return undefined;
  const result = new Map<string, OverlayEntry>();
  Object.values(landmarks).forEach((lm) => {
    if (!lm.coordinate) return;                     // unpositioned → skip
    const entry = lm.metrics?.[selectedMetricId];
    if (!entry || entry.level === 'NONE') return;   // no data / NONE → skip
    result.set(lm.id, {
      value: entry.value ?? QUALITY_LEVEL_SIGN[entry.level],
      color: QUALITY_LEVEL_COLOR[entry.level],
    });
  });
  return result.size > 0 ? result : undefined;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LM_OK: Landmark = {
  id: 'lm-ok', name: 'Alpha', ownerId: 'u1',
  type: 'KEEP',
  coordinate: { q: 0, r: 0 },
  metrics: { 'm1': { metricId: 'm1', level: 'OK', value: '99.9 %' } },
};

const LM_WARNING: Landmark = {
  id: 'lm-warn', name: 'Beta', ownerId: 'u1',
  type: 'KEEP',
  coordinate: { q: 1, r: 0 },
  metrics: { 'm1': { metricId: 'm1', level: 'WARNING' } },   // no explicit value → use sign
};

const LM_ERROR: Landmark = {
  id: 'lm-err', name: 'Gamma', ownerId: 'u1',
  type: 'KEEP',
  coordinate: { q: 2, r: 0 },
  metrics: { 'm1': { metricId: 'm1', level: 'ERROR', value: '12 %' } },
};

const LM_NONE: Landmark = {
  id: 'lm-none', name: 'Delta', ownerId: 'u1',
  type: 'KEEP',
  coordinate: { q: 3, r: 0 },
  metrics: { 'm1': { metricId: 'm1', level: 'NONE' } },
};

const LM_NO_ENTRY: Landmark = {
  id: 'lm-no-entry', name: 'Epsilon', ownerId: 'u1',
  type: 'KEEP',
  coordinate: { q: 4, r: 0 },
};

const LM_UNPOSITIONED: Landmark = {
  id: 'lm-unpos', name: 'Zeta', ownerId: 'u1',
  type: 'KEEP',
  // no coordinate
  metrics: { 'm1': { metricId: 'm1', level: 'OK', value: 'up' } },
};

const ALL_LANDMARKS: Record<string, Landmark> = {
  'lm-ok':       LM_OK,
  'lm-warn':     LM_WARNING,
  'lm-err':      LM_ERROR,
  'lm-none':     LM_NONE,
  'lm-no-entry': LM_NO_ENTRY,
  'lm-unpos':    LM_UNPOSITIONED,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildMetricOverlayEntries', () => {

  it('returns undefined when no metric is selected', () => {
    expect(buildMetricOverlayEntries(null, ALL_LANDMARKS)).toBeUndefined();
  });

  it('returns undefined when no landmark has a non-NONE entry for the metric', () => {
    const onlyNone: Record<string, Landmark> = { 'lm-none': LM_NONE };
    expect(buildMetricOverlayEntries('m1', onlyNone)).toBeUndefined();
  });

  it('returns undefined when all matching landmarks are unpositioned', () => {
    const onlyUnpos: Record<string, Landmark> = { 'lm-unpos': LM_UNPOSITIONED };
    expect(buildMetricOverlayEntries('m1', onlyUnpos)).toBeUndefined();
  });

  it('includes OK landmark with explicit value and correct color', () => {
    const result = buildMetricOverlayEntries('m1', ALL_LANDMARKS)!;
    expect(result.has('lm-ok')).toBe(true);
    expect(result.get('lm-ok')!.value).toBe('99.9 %');
    expect(result.get('lm-ok')!.color).toBe(QUALITY_LEVEL_COLOR['OK']);
  });

  it('falls back to QUALITY_LEVEL_SIGN when value is absent (WARNING)', () => {
    const result = buildMetricOverlayEntries('m1', ALL_LANDMARKS)!;
    expect(result.has('lm-warn')).toBe(true);
    expect(result.get('lm-warn')!.value).toBe(QUALITY_LEVEL_SIGN['WARNING']);
    expect(result.get('lm-warn')!.color).toBe(QUALITY_LEVEL_COLOR['WARNING']);
  });

  it('includes ERROR landmark with explicit value', () => {
    const result = buildMetricOverlayEntries('m1', ALL_LANDMARKS)!;
    expect(result.has('lm-err')).toBe(true);
    expect(result.get('lm-err')!.value).toBe('12 %');
    expect(result.get('lm-err')!.color).toBe(QUALITY_LEVEL_COLOR['ERROR']);
  });

  it('excludes NONE-level entries', () => {
    const result = buildMetricOverlayEntries('m1', ALL_LANDMARKS)!;
    expect(result.has('lm-none')).toBe(false);
  });

  it('excludes landmarks with no entry for the metric', () => {
    const result = buildMetricOverlayEntries('m1', ALL_LANDMARKS)!;
    expect(result.has('lm-no-entry')).toBe(false);
  });

  it('excludes unpositioned landmarks', () => {
    const result = buildMetricOverlayEntries('m1', ALL_LANDMARKS)!;
    expect(result.has('lm-unpos')).toBe(false);
  });

  it('returns undefined when metric id matches no landmark entries', () => {
    expect(buildMetricOverlayEntries('m-unknown', ALL_LANDMARKS)).toBeUndefined();
  });

  it('result contains exactly the three positioned non-NONE landmarks', () => {
    const result = buildMetricOverlayEntries('m1', ALL_LANDMARKS)!;
    expect(result.size).toBe(3);
    expect([...result.keys()].sort()).toEqual(['lm-err', 'lm-ok', 'lm-warn'].sort());
  });

  it('each entry color is a valid hex CSS string', () => {
    const result = buildMetricOverlayEntries('m1', ALL_LANDMARKS)!;
    result.forEach(({ color }) => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('works correctly for a single-landmark map with an OK entry', () => {
    const result = buildMetricOverlayEntries('m1', { 'lm-ok': LM_OK })!;
    expect(result.size).toBe(1);
    expect(result.get('lm-ok')!.value).toBe('99.9 %');
  });

  it('different metric id returns undefined if no landmark has that metric', () => {
    expect(buildMetricOverlayEntries('m-other', ALL_LANDMARKS)).toBeUndefined();
  });

  it('handles landmark with multiple metrics — only the selected one is used', () => {
    const multiMetric: Landmark = {
      id: 'lm-multi', name: 'Multi', ownerId: 'u1', type: 'KEEP',
      coordinate: { q: 9, r: 0 },
      metrics: {
        'm1': { metricId: 'm1', level: 'OK',    value: 'should be used' },
        'm2': { metricId: 'm2', level: 'ERROR', value: 'should be ignored' },
      },
    };
    const result = buildMetricOverlayEntries('m1', { 'lm-multi': multiMetric })!;
    expect(result.get('lm-multi')!.value).toBe('should be used');
    expect(result.get('lm-multi')!.color).toBe(QUALITY_LEVEL_COLOR['OK']);
  });

  it('QUALITY_LEVEL_SIGN fallback is used for each non-NONE level without a value', () => {
    const levels: QualityLevel[] = ['OK', 'WARNING', 'ERROR'];
    levels.forEach((level) => {
      const lm: Landmark = {
        id: `lm-${level}`, name: level, ownerId: 'u1', type: 'KEEP',
        coordinate: { q: 0, r: 0 },
        metrics: { 'm1': { metricId: 'm1', level } },
      };
      const result = buildMetricOverlayEntries('m1', { [`lm-${level}`]: lm })!;
      expect(result.get(`lm-${level}`)!.value).toBe(QUALITY_LEVEL_SIGN[level]);
    });
  });
});

