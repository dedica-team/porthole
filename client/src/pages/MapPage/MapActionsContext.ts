/**
 * MapActionsContext
 *
 * Provides the shared useMapPageActions result to all sub-route view components
 * so they don't need props passed through React Router routes.
 */
import { createContext, useContext } from 'react';
import type { useMapPageActions } from './useMapPageActions';

export type MapActions = ReturnType<typeof useMapPageActions>;

export const MapActionsContext = createContext<MapActions | null>(null);

export function useMapActions(): MapActions {
  const ctx = useContext(MapActionsContext);
  if (!ctx) throw new Error('useMapActions must be used within MapPage');
  return ctx;
}
