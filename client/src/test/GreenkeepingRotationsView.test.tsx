import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GreenkeepingRotationsView from '../components/GreenkeepingRotationsView/GreenkeepingRotationsView';
import * as mapApi from '../api/mapApi';
import { useAuthStore, useMapStore } from '../store/mapStore';
import type { SessionState } from '../types/session';
import type { GreenkeepingRotation } from '../types/greenkeeping';

vi.mock('../api/mapApi');

const MAP_ID = 'map-greenkeeping-test';

const makeMap = (): SessionState => ({
  id: MAP_ID,
  createdAt: new Date().toISOString(),
  collaborators: [
    { id: 'u1', username: 'alice' },
    { id: 'u2', username: 'bob' },
  ],
  landmarks: {},
  connections: {},
  groups: {
    g1: { id: 'g1', name: 'Core', color: '#00ffcc' },
  },
  map: { tiles: [] },
});

const baseRotation: GreenkeepingRotation = {
  id: 'rot-1',
  name: 'Weekly Core Duty',
  description: 'Shared care of the core systems',
  link: 'https://example.com/weekly-core-duty',
  groupIds: ['g1'],
  collaborators: [
    { id: 'entry-1', collaboratorId: 'u1', done: false },
    { id: 'entry-2', collaboratorId: 'u2', done: false },
  ],
};

describe('GreenkeepingRotationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'tok',
      userId: 'u1',
      username: 'alice',
      avatarUrl: null,
      isAdmin: false,
      isAuthenticated: true,
      sessionLoading: false,
      sessionResolved: true,
      tagline: 'for teams',
    });
    useMapStore.setState({
      currentMap: makeMap(),
      maps: [],
      pendingTiles: new Map(),
      selectedTile: null,
      selectedLandmark: null,
      selectedConnectionId: null,
      connectingFromLandmarkId: null,
      relocatingLandmarkId: null,
      pendingConnectionMeta: { type: 'PIPE' },
      editorMode: false,
      editorTool: 'RAISE',
      editorTerrain: 'GRASS',
      rendererQualityProfile: 'balanced',
      mainView: 'greenkeeping',
      pendingView: null,
      confirmPending: false,
      activeProcessId: null,
      activeStageId: null,
      pickingConnection: false,
      processes: [],
      processesFetched: false,
      processesLoading: false,
      processesError: null,
      choreLists: [],
      choreListsFetched: false,
      choreListsLoading: false,
      choreListsError: null,
      activeChoreListId: null,
      greenkeepingRotations: [baseRotation],
      greenkeepingRotationsFetched: true,
      greenkeepingRotationsLoading: false,
      greenkeepingRotationsError: null,
      metrics: {},
      collaboratorMatrix: null,
    });
  });

  it('renders the rotation overview as cards for collaborators', () => {
    render(<GreenkeepingRotationsView />);

    expect(screen.getByText('Weekly Core Duty')).toBeInTheDocument();
    expect(screen.getByText('Shared care of the core systems')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/weekly-core-duty')).toBeInTheDocument();
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getAllByTitle('alice').length).toBeGreaterThan(0);
    expect(screen.getByTitle('bob')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^rotation$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /advance to bob in weekly core duty/i })).toBeInTheDocument();
  });

  it('hides create button for viewers', () => {
    useAuthStore.setState({ userId: 'viewer', username: 'viewer', isAuthenticated: true });
    render(<GreenkeepingRotationsView />);

    expect(screen.queryByRole('button', { name: /^rotation$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /advance to bob in weekly core duty/i })).not.toBeInTheDocument();
  });

  it('does not show an advance button when a rotation has only one collaborator', () => {
    useMapStore.setState({
      greenkeepingRotations: [{
        ...baseRotation,
        collaborators: [{ id: 'entry-1', collaboratorId: 'u1', done: false }],
      }],
    });

    render(<GreenkeepingRotationsView />);

    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /advance to alice in weekly core duty/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /advance to .* in weekly core duty/i })).not.toBeInTheDocument();
  });

  it('opens the edit dialog when the title is clicked', async () => {
    render(<GreenkeepingRotationsView />);

    fireEvent.click(screen.getByText('Weekly Core Duty'));

    expect(await screen.findByText('Edit Rotation')).toBeInTheDocument();
  });

  it('shows delete confirmation inside the edit dialog', async () => {
    render(<GreenkeepingRotationsView />);

    fireEvent.click(screen.getByText('Weekly Core Duty'));

    expect(await screen.findByRole('button', { name: /^delete$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
  });

  it('advances the active collaborator and updates the overview', async () => {
    vi.mocked(mapApi.advanceGreenkeepingRotation).mockResolvedValue({
      ...baseRotation,
      collaborators: [
        { id: 'entry-1', collaboratorId: 'u1', done: true },
        { id: 'entry-2', collaboratorId: 'u2', done: false },
      ],
    });

    render(<GreenkeepingRotationsView />);
    fireEvent.click(screen.getByRole('button', { name: /advance to bob in weekly core duty/i }));

    await waitFor(() => {
      expect(mapApi.advanceGreenkeepingRotation).toHaveBeenCalledWith(MAP_ID, 'rot-1');
      expect(screen.getByText('bob')).toBeInTheDocument();
    });
  });
});

