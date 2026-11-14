// Quality metrics & landmark types

export type QualityLevel = 'NONE' | 'OK' | 'WARNING' | 'ERROR';

export const QUALITY_LEVEL_ORDER: QualityLevel[] = ['NONE', 'OK', 'WARNING', 'ERROR'];

export const QUALITY_LEVEL_COLOR: Record<QualityLevel, string> = {
  NONE:    '#6b7280',
  OK:      '#22c55e',
  WARNING: '#f97316',
  ERROR:   '#ef4444',
};

export const QUALITY_LEVEL_LABEL: Record<QualityLevel, string> = {
  NONE:    'None',
  OK:      'OK',
  WARNING: 'Warning',
  ERROR:   'Error',
};

export const QUALITY_LEVEL_SIGN: Record<QualityLevel, string> = {
  NONE:    '—',
  OK:      '✔',
  WARNING: '!',
  ERROR:   '✘',
};

export function defaultValueForLevel(level: QualityLevel): string | undefined {
  return level === 'NONE' ? undefined : QUALITY_LEVEL_SIGN[level];
}

export function worstLevel(entries: LandmarkMetricEntry[]): QualityLevel {
  return entries.reduce<QualityLevel>(
    (worst, e) =>
      QUALITY_LEVEL_ORDER.indexOf(e.level) > QUALITY_LEVEL_ORDER.indexOf(worst)
        ? e.level
        : worst,
    'NONE',
  );
}

export type MatchStrategy = 'NAME' | 'LINK' | 'ALIAS';

export interface MetricTransformation {
  id: string;
  name: string;
  metricId: string;
  requestUrl: string;
  httpMethod: string;
  jqFilter: string;
  matchBy: MatchStrategy;
  matchKey?: string;
  lastPayloadSample?: string;
  updatedAt?: string;
}

export interface MetricTransformationTemplate {
  id: string;
  name: string;
  description?: string;
  requestUrl: string;
  httpMethod: string;
  jqFilter: string;
  matchBy: MatchStrategy;
  matchKey?: string;
  samplePayload: string;
  directPayloadSample?: PushMetricValuesRequest;
}

export interface MetricElementValueDto {
  element: string;
  value?: string;
  level?: QualityLevel;
  description?: string;
  link?: string;
  linkText?: string;
  badges?: Record<string, string>;
}

export interface PushMetricValuesRequest {
  matchBy: MatchStrategy;
  matchKey?: string;
  values: MetricElementValueDto[];
}

export interface PushMetricValuesResponse {
  updatedCount: number;
  unmatchedElements: string[];
  warnings: string[];
}

export interface QualityMetric {
  id: string;
  name: string;
  description: string;
  link?: string;
  transformations?: MetricTransformation[];
}

export interface MetricTemplate {
  id: string;
  name: string;
  description: string;
}

export interface LandmarkMetricEntry {
  metricId: string;
  value?: string;
  description?: string;
  link?: string;
  linkText?: string;
  level: QualityLevel;
  badges?: Record<string, string>;
}

export type LandmarkType =
  | 'LIGHTHOUSE'
  | 'RUINS'
  | 'SILO'
  | 'KEEP'
  | 'WINDMILL'
  | 'HOUSE'
  | 'WATCHTOWER'
  | 'PUMP_STATION'
  | 'FURNACE'
  | 'OIL_PUMP'
  | 'WALL'
  | 'SATELLITE_DISH'
  | 'ANTENNA'
  | 'ATOMIC_REACTOR'
  | 'PORTAL'
  | 'SAILBOAT'
  | 'MODERN_SHIP'
  | 'OIL_RIG'
  | 'SUBMARINE'
  | 'BUOY';

export const LANDMARK_TYPE_LABELS: Record<LandmarkType, string> = {
  LIGHTHOUSE:      '🗼 Lighthouse',
  RUINS:           '🏚 Ruins',
  SILO:            '🏗 Silo',
  KEEP:            '🏰 Keep',
  WINDMILL:        '🌬 Windmill',
  HOUSE:           '🏠 House',
  WATCHTOWER:      '🗽 Watchtower',
  PUMP_STATION:    '⚙️ Pump Station',
  FURNACE:         '🔥 Furnace',
  OIL_PUMP:        '🛢 Oil Pump',
  WALL:            '🧱 Wall',
  SATELLITE_DISH:  '📡 Satellite Dish',
  ANTENNA:         '📶 Antenna',
  ATOMIC_REACTOR:  '⚛️ Atomic Reactor',
  PORTAL:          '🌀 Portal',
  SAILBOAT:        '⛵ Sailboat',
  MODERN_SHIP:     '🚢 Modern Ship',
  OIL_RIG:         '🛢 Oil Rig',
  SUBMARINE:       '🤿 Submarine',
  BUOY:            '🔴 Buoy',
};

export const ALL_LANDMARK_TYPES: LandmarkType[] = Object.keys(LANDMARK_TYPE_LABELS) as LandmarkType[];

export const DECORATIVE_LANDMARK_TYPES: ReadonlySet<LandmarkType> = new Set<LandmarkType>([
  'WALL',
]);

export function isDecorative(type: LandmarkType): boolean {
  return DECORATIVE_LANDMARK_TYPES.has(type);
}

export interface LandmarkGroup {
  id: string;
  name: string;
  color: string;
  description?: string;
  link?: string;
}

export interface Landmark {
  id: string;
  name: string;
  ownerId: string | null;
  coordinate?: import('./hex').HexCoordinate;
  type: LandmarkType;
  description?: string;
  groupId?: string;
  link?: string;
  links?: Record<string, string>;
  metrics?: Record<string, LandmarkMetricEntry>;
  aliases?: string[];
}

