// Tower-defense game state shared with the server.

export type GamePhase = 'IDLE' | 'ACTIVE' | 'INTERMISSION';
export type BugType = 'CRAWLER';

export interface Bug {
  id: string;
  coordinate: { q: number; r: number };
  spawnCoordinate: { q: number; r: number };
  hp: number;
  type: BugType;
  targetLandmarkId?: string | null;
  spawnedAt: string;
}

export interface GameState {
  wave: number;
  phase: GamePhase;
  bugs: Record<string, Bug>;
  buildingHealth: Record<string, number>;
  /** Hit points a building starts with; used for health-bar scaling. */
  buildingMaxHealth?: number;
  towerOccupants: Record<string, string>;
  nextWaveAt?: string | null;
  waveStartedAt?: string | null;
}

export interface ShootResult {
  hit: boolean;
  bugId?: string | null;
  landmarkId?: string | null;
  hitPosition?: { x: number; y: number; z: number } | null;
}
