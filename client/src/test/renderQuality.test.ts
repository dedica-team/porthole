import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  readRendererQualityOverride,
  resolveRendererQuality,
} from '@/components/HexGrid/renderQuality';

describe('renderQuality', () => {
  it('defaults to balanced when no override is present', () => {
    const quality = resolveRendererQuality(undefined, {});

    expect(quality.profile).toBe('balanced');
    expect(quality.antialias).toBe(true);
    expect(quality.maxPixelRatio).toBe(1.5);
    expect(quality.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(quality.toneMappingExposure).toBe(1.25);
  });

  it('uses explicit profile over environment overrides', () => {
    const quality = resolveRendererQuality('low', {
      localStorageValue: 'high',
    });

    expect(quality.profile).toBe('low');
    expect(quality.antialias).toBe(false);
    expect(quality.maxPixelRatio).toBe(1);
    expect(quality.toneMapping).toBe(THREE.NoToneMapping);
    expect(quality.toneMappingExposure).toBe(1);
  });

  it('uses localStorage override when query-string override is absent', () => {
    expect(readRendererQualityOverride({
      localStorageValue: 'low',
    })).toBe('low');
  });

  it('ignores invalid override values', () => {
    expect(readRendererQualityOverride({
      localStorageValue: 'retro',
    })).toBeNull();
  });
});

