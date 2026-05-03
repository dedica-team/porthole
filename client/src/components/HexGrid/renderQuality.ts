import * as THREE from 'three';

export type RendererQualityProfile = 'high' | 'balanced' | 'low';
export const DEFAULT_RENDERER_QUALITY_PROFILE: RendererQualityProfile = 'balanced';

export interface RendererQualitySettings {
  profile: RendererQualityProfile;
  antialias: boolean;
  maxPixelRatio: number;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
}

export interface RendererQualityEnv {
  localStorageValue?: string | null;
}

export const RENDERER_QUALITY_STORAGE_KEY = 'hexgrid-renderer-quality';

const QUALITY_SETTINGS: Record<RendererQualityProfile, Omit<RendererQualitySettings, 'profile'>> = {
  high: {
    antialias: true,
    maxPixelRatio: 2,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.4,
  },
  balanced: {
    antialias: true,
    maxPixelRatio: 1.5,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.25,
  },
  low: {
    antialias: false,
    maxPixelRatio: 1,
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
  },
};

export function isRendererQualityProfile(value: string | null | undefined): value is RendererQualityProfile {
  return value === 'high' || value === 'balanced' || value === 'low';
}

export function readRendererQualityOverride(env: RendererQualityEnv): RendererQualityProfile | null {
  const storageValue = env.localStorageValue ?? null;
  if (isRendererQualityProfile(storageValue)) return storageValue;

  return null;
}

export function getRendererQualityEnv(): RendererQualityEnv {
  if (typeof window === 'undefined') return {};

  let localStorageValue: string | null | undefined;
  try {
    localStorageValue = window.localStorage.getItem(RENDERER_QUALITY_STORAGE_KEY);
  } catch {
    localStorageValue = null;
  }

  return {
    localStorageValue,
  };
}

export function resolveRendererQuality(
  explicitProfile?: RendererQualityProfile,
  env: RendererQualityEnv = getRendererQualityEnv(),
): RendererQualitySettings {
  const profile = explicitProfile ?? readRendererQualityOverride(env) ?? DEFAULT_RENDERER_QUALITY_PROFILE;
  return {
    profile,
    ...QUALITY_SETTINGS[profile],
  };
}

