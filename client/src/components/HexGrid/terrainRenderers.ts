/**
 * terrainRenderers.ts
 * Re-exports all renderer classes and provides TERRAIN_RENDERER_MAP –
 * a lookup from every Terrain value to its TerrainRenderer instance.
 *
 * Individual renderers live in ./renderers/.
 * Shared utilities and the TerrainRenderer interface are in ./terrainUtils.ts.
 * Tile surface colours are owned by each renderer via tileColors().
 */
import type { Terrain } from '@/types/map.ts';
import type { TerrainRenderer } from './terrainUtils';
export { tileHeight, type TerrainRenderer, type TileColors } from './terrainUtils';
import { WaterRenderer }    from './renderers/WaterRenderer';
import { GrassRenderer }    from './renderers/GrassRenderer';
import { ForestRenderer }   from './renderers/ForestRenderer';
import { RocksRenderer }    from './renderers/RocksRenderer';
import { MeadowRenderer }   from './renderers/MeadowRenderer';
import { DesertRenderer }   from './renderers/DesertRenderer';
import { BeachRenderer }    from './renderers/BeachRenderer';
import { SwampRenderer }    from './renderers/SwampRenderer';
import { ScorchedRenderer } from './renderers/ScorchedRenderer';
import { SnowyRenderer }    from './renderers/SnowyRenderer';
import { IceRenderer }      from './renderers/IceRenderer';

// ── Singleton map: Terrain → TerrainRenderer ─────────────────────────────────
export const TERRAIN_RENDERER_MAP: Record<Terrain, TerrainRenderer> = {
  WATER:    new WaterRenderer(),
  GRASS:    new GrassRenderer(),
  FOREST:   new ForestRenderer(),
  ROCKS:    new RocksRenderer(),
  MEADOW:   new MeadowRenderer(),
  DESERT:   new DesertRenderer(),
  BEACH:    new BeachRenderer(),
  SWAMP:    new SwampRenderer(),
  SCORCHED: new ScorchedRenderer(),
  SNOWY:    new SnowyRenderer(),
  ICE:      new IceRenderer(),
};
