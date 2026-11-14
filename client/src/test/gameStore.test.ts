import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/mapStore';
import type { GameState } from '../types/game';

const game = (): GameState => ({
  wave: 2,
  phase: 'ACTIVE',
  bugs: {
    b1: {
      id: 'b1',
      coordinate: { q: 1, r: 0 },
      spawnCoordinate: { q: 1, r: 0 },
      hp: 1,
      type: 'CRAWLER',
      targetLandmarkId: null,
      spawnedAt: '2026-01-01T00:00:00Z',
    },
    b2: {
      id: 'b2',
      coordinate: { q: 2, r: 0 },
      spawnCoordinate: { q: 2, r: 0 },
      hp: 1,
      type: 'CRAWLER',
      targetLandmarkId: 'l1',
      spawnedAt: '2026-01-01T00:00:00Z',
    },
  },
  buildingHealth: {},
  towerOccupants: {},
  nextWaveAt: null,
});

describe('mapStore – tower-defense game state', () => {
  beforeEach(() => {
    useMapStore.setState({ gameState: null, activeWatchtowerId: null });
  });

  it('stores the game state from a broadcast', () => {
    useMapStore.getState().setGameState(game());
    expect(useMapStore.getState().gameState?.wave).toBe(2);
    expect(Object.keys(useMapStore.getState().gameState!.bugs)).toHaveLength(2);
  });

  it('removes a bug optimistically without mutating the previous object', () => {
    const initial = game();
    useMapStore.setState({ gameState: initial });

    useMapStore.getState().removeBug('b1');

    const updated = useMapStore.getState().gameState!;
    expect(Object.keys(updated.bugs)).toEqual(['b2']);
    expect(Object.keys(initial.bugs)).toHaveLength(2);
  });

  it('ignores removal of an unknown bug', () => {
    const initial = game();
    useMapStore.setState({ gameState: initial });

    useMapStore.getState().removeBug('missing');

    expect(useMapStore.getState().gameState).toBe(initial);
  });

  it('tracks the active watchtower', () => {
    useMapStore.getState().setActiveWatchtowerId('tower-1');
    expect(useMapStore.getState().activeWatchtowerId).toBe('tower-1');
    useMapStore.getState().setActiveWatchtowerId(null);
    expect(useMapStore.getState().activeWatchtowerId).toBeNull();
  });
});
