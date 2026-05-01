/**
 * Landmark renderers – barrel export.
 * Import from here instead of the individual files.
 */
export type { LandmarkRenderer, Adjacent } from './landmarkUtils';
export { statusLight } from './landmarkUtils';

export { KeepRenderer }          from './KeepRenderer';
export { LighthouseRenderer }    from './LighthouseRenderer';
export { RuinsRenderer }         from './RuinsRenderer';
export { SiloRenderer }          from './SiloRenderer';
export { WindmillRenderer }      from './WindmillRenderer';
export { HouseRenderer }         from './HouseRenderer';
export { WatchtowerRenderer }    from './WatchtowerRenderer';
export { PumpStationRenderer }   from './PumpStationRenderer';
export { FurnaceRenderer }       from './FurnaceRenderer';
export { OilPumpRenderer }       from './OilPumpRenderer';
export { WallRenderer }          from './WallRenderer';
export { SatelliteDishRenderer } from './SatelliteDishRenderer';
export { AntennaRenderer }       from './AntennaRenderer';
export { AtomicReactorRenderer } from './AtomicReactorRenderer';
export { PortalRenderer }        from './PortalRenderer';
export { SailboatRenderer }      from './SailboatRenderer';
export { ModernShipRenderer }    from './ModernShipRenderer';
export { OilRigRenderer }        from './OilRigRenderer';
export { SubmarineRenderer }     from './SubmarineRenderer';
export { BuoyRenderer }          from './BuoyRenderer';

import type { LandmarkType } from '@/types/landmark';
import type { LandmarkRenderer } from './landmarkUtils';
import { KeepRenderer }          from './KeepRenderer';
import { LighthouseRenderer }    from './LighthouseRenderer';
import { RuinsRenderer }         from './RuinsRenderer';
import { SiloRenderer }          from './SiloRenderer';
import { WindmillRenderer }      from './WindmillRenderer';
import { HouseRenderer }         from './HouseRenderer';
import { WatchtowerRenderer }    from './WatchtowerRenderer';
import { PumpStationRenderer }   from './PumpStationRenderer';
import { FurnaceRenderer }       from './FurnaceRenderer';
import { OilPumpRenderer }       from './OilPumpRenderer';
import { WallRenderer }          from './WallRenderer';
import { SatelliteDishRenderer } from './SatelliteDishRenderer';
import { AntennaRenderer }       from './AntennaRenderer';
import { AtomicReactorRenderer } from './AtomicReactorRenderer';
import { PortalRenderer }        from './PortalRenderer';
import { SailboatRenderer }      from './SailboatRenderer';
import { ModernShipRenderer }    from './ModernShipRenderer';
import { OilRigRenderer }        from './OilRigRenderer';
import { SubmarineRenderer }     from './SubmarineRenderer';
import { BuoyRenderer }          from './BuoyRenderer';

const RENDERERS: Record<LandmarkType, LandmarkRenderer> = {
  LIGHTHOUSE:     new LighthouseRenderer(),
  RUINS:          new RuinsRenderer(),
  SILO:           new SiloRenderer(),
  KEEP:           new KeepRenderer(),
  WINDMILL:       new WindmillRenderer(),
  HOUSE:          new HouseRenderer(),
  WATCHTOWER:     new WatchtowerRenderer(),
  PUMP_STATION:   new PumpStationRenderer(),
  FURNACE:        new FurnaceRenderer(),
  OIL_PUMP:       new OilPumpRenderer(),
  WALL:           new WallRenderer(),
  SATELLITE_DISH: new SatelliteDishRenderer(),
  ANTENNA:        new AntennaRenderer(),
  ATOMIC_REACTOR: new AtomicReactorRenderer(),
  PORTAL:         new PortalRenderer(),
  SAILBOAT:       new SailboatRenderer(),
  MODERN_SHIP:    new ModernShipRenderer(),
  OIL_RIG:        new OilRigRenderer(),
  SUBMARINE:      new SubmarineRenderer(),
  BUOY:           new BuoyRenderer(),
};

const FALLBACK: LandmarkRenderer = RENDERERS['KEEP'];

/** Returns the renderer for the given type, falling back to KEEP for unknown types. */
export function getLandmarkRenderer(type: string): LandmarkRenderer {
  return (RENDERERS as Record<string, LandmarkRenderer>)[type] ?? FALLBACK;
}

/** Returns the colour for the given type, falling back to KEEP for unknown types. */
export function getLandmarkColor(type: string): number {
  return ((RENDERERS as Record<string, LandmarkRenderer>)[type] ?? FALLBACK).color;
}
