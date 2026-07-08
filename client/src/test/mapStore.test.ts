import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore, useAuthStore } from '../store/mapStore';
import type { SessionState } from '../types/session';
const makeMap = (): SessionState => ({
  id: 'g1',
  createdAt: new Date().toISOString(),
  collaborators: [],
  joinRequests: [],
  landmarks: {},
  connections: {},
  groups: {},
  map: {
    tiles: [
      { coordinate: { q: 0, r: 0 }, elevation: 2, terrain: 'FOREST', ownerId: null },
      { coordinate: { q: 1, r: 0 }, elevation: 1, terrain: 'GRASS',  ownerId: null },
      { coordinate: { q: 2, r: 0 }, elevation: 0, terrain: 'WATER',  ownerId: null },
    ],
  },
});

describe('mapStore – updateTile (regression: updateTile was missing from implementation)', () => {
  beforeEach(() => {
    useMapStore.setState({ currentMap: makeMap(), maps: [] });
  });

  it('updateTile is a function', () => {
    expect(typeof useMapStore.getState().updateTile).toBe('function');
  });

  it('replaces only the target tile, leaving others unchanged', () => {
    const { updateTile } = useMapStore.getState();
    updateTile('g1', { coordinate: { q: 1, r: 0 }, elevation: 3, terrain: 'ROCKS', ownerId: null });

    const tiles = useMapStore.getState().currentMap!.map.tiles;
    const changed = tiles.find((t) => t.coordinate.q === 1 && t.coordinate.r === 0)!;
    const untouched0 = tiles.find((t) => t.coordinate.q === 0 && t.coordinate.r === 0)!;
    const untouched2 = tiles.find((t) => t.coordinate.q === 2 && t.coordinate.r === 0)!;

    expect(changed.elevation).toBe(3);
    expect(changed.terrain).toBe('ROCKS');
    expect(untouched0.elevation).toBe(2);
    expect(untouched2.elevation).toBe(0);
  });

  it('does nothing when the mapId does not match', () => {
    const before = useMapStore.getState().currentMap!.map.tiles;
    useMapStore.getState().updateTile('other-map', {
      coordinate: { q: 0, r: 0 }, elevation: 5, terrain: 'ROCKS', ownerId: null,
    });
    expect(useMapStore.getState().currentMap!.map.tiles).toBe(before);
  });

  it('does not replace the other map properties (landmarks, collaborators, connections)', () => {
    const map: SessionState = {
      ...makeMap(),
      landmarks: { 'l1': { id: 'l1', name: 'Keep', ownerId: 'p1', coordinate: { q: 0, r: 0 }, type: 'KEEP' } },
      collaborators: [{ id: 'p1', username: 'alice' }],
    };
    useMapStore.setState({ currentMap: map });
    useMapStore.getState().updateTile('g1', {
      coordinate: { q: 0, r: 0 }, elevation: 0, terrain: 'WATER', ownerId: null,
    });
    const state = useMapStore.getState().currentMap!;
    expect(Object.keys(state.landmarks)).toHaveLength(1);
    expect(state.collaborators).toHaveLength(1);
  });
});

describe('mapStore – updateMap', () => {
  beforeEach(() => {
    useMapStore.setState({ currentMap: makeMap(), maps: [makeMap()] });
  });

  it('replaces currentMap when ids match', () => {
    const updated: SessionState = { ...makeMap(), collaborators: [{ id: 'p1', username: 'bob' }] };
    useMapStore.getState().updateMap(updated);
    expect(useMapStore.getState().currentMap!.collaborators[0].username).toBe('bob');
  });

  it('does not replace currentMap when ids differ', () => {
    const other: SessionState = { ...makeMap(), id: 'other' };
    useMapStore.getState().updateMap(other);
    expect(useMapStore.getState().currentMap!.id).toBe('g1');
  });

  it('updates the maps list', () => {
    const updated: SessionState = { ...makeMap(), collaborators: [{ id: 'p1', username: 'carol' }] };
    useMapStore.getState().updateMap(updated);
    expect(useMapStore.getState().maps[0].collaborators[0].username).toBe('carol');
  });

  it('preserves name and description when updateMap is called', () => {
    const updated: SessionState = { ...makeMap(), name: 'Named Map', description: 'Some desc' };
    useMapStore.getState().updateMap(updated);
    expect(useMapStore.getState().currentMap!.name).toBe('Named Map');
    expect(useMapStore.getState().currentMap!.description).toBe('Some desc');
  });

  it('clears name when updateMap receives map without name', () => {
    useMapStore.setState({ currentMap: { ...makeMap(), name: 'Old Name' }, maps: [] });
    const updated: SessionState = { ...makeMap() };
    useMapStore.getState().updateMap(updated);
    expect(useMapStore.getState().currentMap!.name).toBeUndefined();
  });

  it('syncs selectedLandmark from the updated map so edits appear immediately', () => {
    const landmark = { id: 'lm1', name: 'Old Name', ownerId: 'p1', coordinate: { q: 0, r: 0 }, type: 'KEEP' as const };
    useMapStore.setState({
      currentMap: { ...makeMap(), landmarks: { lm1: landmark } },
      maps: [],
      selectedLandmark: landmark,
    });
    const updatedLandmark = { ...landmark, link: 'https://example.com' };
    const updated: SessionState = { ...makeMap(), landmarks: { lm1: updatedLandmark } };
    useMapStore.getState().updateMap(updated);
    expect(useMapStore.getState().selectedLandmark?.link).toBe('https://example.com');
  });
});

describe('mapStore – updateCollaboratorUsername', () => {
  const mapWithCollaborators: SessionState = {
    ...makeMap(),
    collaborators: [
      { id: 'u1', username: 'alice' },
      { id: 'u2', username: 'bob' },
    ],
  };

  beforeEach(() => {
    useMapStore.setState({ currentMap: mapWithCollaborators, maps: [] });
  });

  it('updates the matching collaborator username', () => {
    useMapStore.getState().updateCollaboratorUsername('u1', 'alice2');
    const collaborators = useMapStore.getState().currentMap!.collaborators;
    expect(collaborators.find((c) => c.id === 'u1')?.username).toBe('alice2');
  });

  it('does not affect other collaborators', () => {
    useMapStore.getState().updateCollaboratorUsername('u1', 'alice2');
    const collaborators = useMapStore.getState().currentMap!.collaborators;
    expect(collaborators.find((c) => c.id === 'u2')?.username).toBe('bob');
  });

  it('does nothing when currentMap is null', () => {
    useMapStore.setState({ currentMap: null });
    expect(() => useMapStore.getState().updateCollaboratorUsername('u1', 'alice2')).not.toThrow();
  });

  it('does nothing when userId does not match any collaborator', () => {
    useMapStore.getState().updateCollaboratorUsername('unknown', 'ghost');
    const collaborators = useMapStore.getState().currentMap!.collaborators;
    expect(collaborators.map((c) => c.username)).toEqual(['alice', 'bob']);
  });
});

describe('useAuthStore – setUsername', () => {
  beforeEach(() => {
    useAuthStore.setState({ username: 'alice', isAuthenticated: true });
  });

  it('updates the username in auth store', () => {
    useAuthStore.getState().setUsername('alice2');
    expect(useAuthStore.getState().username).toBe('alice2');
  });

  it('does not change other auth state fields', () => {
    useAuthStore.getState().setUsername('alice2');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});

describe('useAuthStore – session state', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: null, userId: null, username: null, avatarUrl: null, isAuthenticated: false, sessionLoading: false, sessionResolved: false,
    });
  });

  it('login stores avatarUrl in state and marks the session resolved', () => {
    useAuthStore.getState().login('u1', 'alice', 'https://avatars.githubusercontent.com/u/1');
    expect(useAuthStore.getState().avatarUrl).toBe('https://avatars.githubusercontent.com/u/1');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().sessionResolved).toBe(true);
  });

  it('login with null avatarUrl keeps avatarUrl null', () => {
    useAuthStore.getState().login('u1', 'alice', null);
    expect(useAuthStore.getState().avatarUrl).toBeNull();
  });

  it('logout clears auth state and keeps the session resolved', () => {
    useAuthStore.getState().login('u1', 'alice', 'https://avatars.githubusercontent.com/u/1');
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().avatarUrl).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().sessionResolved).toBe(true);
  });

  it('setSession populates the authenticated user from the server bootstrap', () => {
    useAuthStore.getState().setSession({ userId: 'u99', username: 'bob', avatarUrl: 'https://avatars.githubusercontent.com/u/99' });
    expect(useAuthStore.getState().avatarUrl).toBe('https://avatars.githubusercontent.com/u/99');
    expect(useAuthStore.getState().userId).toBe('u99');
    expect(useAuthStore.getState().sessionResolved).toBe(true);
  });
});

