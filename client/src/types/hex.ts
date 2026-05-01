// Hex grid / map primitives

export type Terrain = 'WATER' | 'GRASS' | 'FOREST' | 'ROCKS' | 'MEADOW' | 'DESERT' | 'BEACH' | 'SWAMP' | 'SCORCHED' | 'SNOWY' | 'ICE';

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

export interface MapData {
  tiles: HexTile[];
}

