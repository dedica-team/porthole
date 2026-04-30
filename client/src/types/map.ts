// Mirrors the server-side domain model
import type React from 'react';

export type QualityLevel = 'NONE' | 'OK' | 'WARNING' | 'ERROR';

export const QUALITY_LEVEL_ORDER: QualityLevel[] = ['NONE', 'OK', 'WARNING', 'ERROR'];

export const QUALITY_LEVEL_COLOR: Record<QualityLevel, string> = {
  NONE:    '#6b7280', // gray-500
  OK:      '#22c55e', // green-500
  WARNING: '#f59e0b', // amber-500
  ERROR:   '#ef4444', // red-500
};

/** Filled background badge styles with matching border. Use as inline style={{ ...QUALITY_LEVEL_BADGE_STYLE[level] }} */
export const QUALITY_LEVEL_BADGE_STYLE: Record<QualityLevel, React.CSSProperties> = {
  NONE:    { background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.4)' },
  OK:      { background: 'rgba(34,197,94,0.15)',   color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' },
  WARNING: { background: 'rgba(245,158,11,0.15)',  color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' },
  ERROR:   { background: 'rgba(239,68,68,0.15)',   color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' },
};

export const QUALITY_LEVEL_LABEL: Record<QualityLevel, string> = {
  NONE:    'None',
  OK:      'OK',
  WARNING: 'Warning',
  ERROR:   'Error',
};

/** UTF-8 signs shown when no explicit value is provided for a level. */
export const QUALITY_LEVEL_SIGN: Record<QualityLevel, string> = {
  NONE:    '—',
  OK:      '✔',
  WARNING: '!',
  ERROR:   '✘',
};

/**
 * Returns the auto-fill sign for a level, or undefined for NONE.
 * Used when the user saves a metric with an empty value field.
 */
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

export interface QualityMetric {
  id: string;
  name: string;
  description: string;
}

export interface MetricTemplate {
  id: string;
  name: string;
  description: string;
}

export interface LandmarkMetricEntry {
  metricId: string;
  value?: string;
  link?: string;
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

/**
 * Landmark types that are purely decorative:
 *  – name is optional (falls back to a generated id)
 *  – they are excluded from the metrics view
 */
export const DECORATIVE_LANDMARK_TYPES: ReadonlySet<LandmarkType> = new Set<LandmarkType>([
  'WALL',
]);

/** Returns true when the given type is decorative (no name required, no metrics). */
export function isDecorative(type: LandmarkType): boolean {
  return DECORATIVE_LANDMARK_TYPES.has(type);
}

export type Terrain = 'WATER' | 'GRASS' | 'FOREST' | 'ROCKS' | 'MEADOW' | 'DESERT' | 'BEACH' | 'SWAMP' | 'SCORCHED' | 'SNOWY' | 'ICE';

export interface LandmarkGroup {
  id: string;
  name: string;
  color: string; // CSS hex, e.g. "#e74c3c"
  description?: string;
  link?: string;
}

export interface HexCoordinate {
  q: number;
  r: number;
}

export interface HexTile {
  coordinate: HexCoordinate;
  elevation: number;
  terrain: Terrain;
  ownerId: string | null;
}

export interface Landmark {
  id: string;
  name: string;
  ownerId: string | null;
  coordinate?: HexCoordinate;
  type: LandmarkType;
  description?: string;
  groupId?: string;
  link?: string;
  metrics?: Record<string, LandmarkMetricEntry>;
}

export function isUnpositionedLandmark(landmark: Landmark): boolean {
  return landmark.coordinate == null;
}

export function isPositionedLandmark(landmark: Landmark): boolean {
  return landmark.coordinate != null;
}

export interface Connection {
  id: string;
  originId: string;
  targetId: string;
  path: HexCoordinate[];
  type: ConnectionType;
  name?: string;
  description?: string;
}

export type ConnectionType = 'PIPE' | 'TELEGRAPH' | 'STREET' | 'ARROW';

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  PIPE:      '🔧 Pipe',
  TELEGRAPH: '📡 Telegraph',
  STREET:    '🛣️ Street',
  ARROW:     '➡️ Arrow',
};

export const ALL_CONNECTION_TYPES: ConnectionType[] = Object.keys(CONNECTION_TYPE_LABELS) as ConnectionType[];

export interface Collaborator {
  id: string;
  username: string;
  avatarUrl?: string;
}

export interface JoinRequest {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  requestedAt: string;
}

export interface MapData {
  tiles: HexTile[];
}

export interface MapState {
  id: string;
  name?: string;
  description?: string;
  collaborationMode?: CollaborationMode;
  map: MapData;
  collaborators: Collaborator[];
  joinRequests?: JoinRequest[];
  landmarks: Record<string, Landmark>;
  connections: Record<string, Connection>;
  groups: Record<string, LandmarkGroup>;
  metrics?: Record<string, QualityMetric>;
  collaboratorMatrix?: CollaboratorMatrix;
  createdAt: string;
}

export type CollaborationMode = 'OPEN' | 'REQUEST' | 'PRIVATE';

export const COLLABORATION_MODE_LABELS: Record<CollaborationMode, string> = {
  OPEN:    'Open – anyone can view and edit',
  REQUEST: 'Request – anyone can view, collaborators can edit',
  PRIVATE: 'Private – collaborators only',
};

export interface AuthSession {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isAdmin?: boolean;
}

export interface AuthResponse extends AuthSession {
  token?: string | null;
}

// ── Collaborator × Landmark Matrix ──────────────────────────────────────────

export type MatrixLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export const MATRIX_LEVEL_ORDER: MatrixLevel[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];

export const MATRIX_LEVEL_LABEL: Record<MatrixLevel, string> = {
  NONE:   'n/a',
  LOW:    'Beginner',
  MEDIUM: 'Advanced',
  HIGH:   'Expert',
};

export const MATRIX_LEVEL_BADGE_CLASS: Record<MatrixLevel, string> = {
  HIGH:   'bg-green-900 text-green-300',
  MEDIUM: 'bg-yellow-900 text-yellow-300',
  LOW:    'bg-red-900 text-red-300',
  NONE:   'bg-muted text-muted-foreground',
};

export const MATRIX_LEVEL_BADGE_STYLE: Record<MatrixLevel, React.CSSProperties> = {
  HIGH:   { background: 'rgba(34,197,94,0.15)',   color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' },
  MEDIUM: { background: 'rgba(245,158,11,0.15)',  color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' },
  LOW:    { background: 'rgba(239,68,68,0.15)',   color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' },
  NONE:   { background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.4)' },
};

export interface CollaboratorMatrixEntry {
  level: MatrixLevel;
}

export interface CollaboratorMatrix {
  name: string;
  entries: Record<string, Record<string, CollaboratorMatrixEntry>>;
}

// ── Processes ────────────────────────────────────────────────────────────────

export type StageConnectionDirection = 'FORWARD' | 'REVERSE' | 'BIDIRECTIONAL';

export interface StageConnection {
  id: string;                          // own entity ID (not the Connection ID)
  connectionId: string;                // ref to Connection.id in MapState.connections
  title?: string;                      // optional display title for this stage entry
  direction: StageConnectionDirection; // FORWARD = origin→target, REVERSE = target→origin, BIDIRECTIONAL
}

export interface ProcessStage {
  id: string;
  name?: string;
  order: number;
  connections: StageConnection[];
}

export interface Process {
  id: string;
  name: string;
  description?: string;
  stages: ProcessStage[];
}

/** Single highlight colour used for all process arrows / connection highlights. */
export const PROCESS_HIGHLIGHT_COLOR = '#38bdf8'; // sky-400

// ── Chore Todo Lists ──────────────────────────────────────────────────────────

export type ChoreEntryState = 'NONE' | 'ONGOING' | 'BLOCKED' | 'DONE';

export const CHORE_ENTRY_STATE_LABEL: Record<ChoreEntryState, string> = {
  NONE:    'None',
  ONGOING: 'Ongoing',
  BLOCKED: 'Blocked',
  DONE:    'Done',
};

export const CHORE_ENTRY_STATE_BADGE_STYLE: Record<ChoreEntryState, React.CSSProperties> = {
  NONE:    { background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.4)' },
  ONGOING: { background: 'rgba(245,158,11,0.15)',  color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' },
  BLOCKED: { background: 'rgba(239,68,68,0.15)',   color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' },
  DONE:    { background: 'rgba(34,197,94,0.15)',   color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' },
};

export const CHORE_ENTRY_STATES: ChoreEntryState[] = ['NONE', 'ONGOING', 'BLOCKED', 'DONE'];

export interface ChoreEntry {
  landmarkId: string;
  state: ChoreEntryState;
  assigneeId?: string;
  link?: string;
  note?: string;
}

export interface ChoreList {
  id: string;
  title: string;
  completed: boolean;
  link?: string;
  entries: Record<string, ChoreEntry>;
}

