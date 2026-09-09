import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SessionOverviewView from '../pages/MapPage/SessionOverviewView';
import { MapActionsContext } from '../pages/MapPage/MapActionsContext';
import type { MapActions } from '../pages/MapPage/MapActionsContext';
import { useMapStore } from '../store/mapStore';
import * as mapApi from '../api/mapApi';

const mockActions: MapActions = {
  handleCreateGroup: vi.fn(),
  handleEditGroup: vi.fn(),
  handleRemoveGroup: vi.fn(),
  actionLoading: false,
  error: null,
  setError: vi.fn(),
  handleSetMatrixEntry: vi.fn(),
  handleEditLandmark: vi.fn(),
  handleRemoveLandmark: vi.fn(),
} as unknown as MapActions;

vi.mock('../api/mapApi', () => ({
  fetchChoreLists: vi.fn(),
  fetchGreenkeepingRotations: vi.fn(),
  fetchCollaboratorMatrix: vi.fn(),
}));

const SESSION_ID = 'sess-1';

const BASE_MAP = {
  id: SESSION_ID,
  createdAt: '',
  collaborators: [{ id: 'u1', username: 'alice' }],
  connections: {},
  map: { tiles: [] },
  landmarks: {},
  groups: {},
};

function renderView() {
  return render(
    <MapActionsContext.Provider value={mockActions}>
      <MemoryRouter initialEntries={[`/session/${SESSION_ID}`]}>
        <Routes>
          <Route path="/session/:id" element={<SessionOverviewView />} />
        </Routes>
      </MemoryRouter>
    </MapActionsContext.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(mapApi.fetchChoreLists).mockResolvedValue([]);
  vi.mocked(mapApi.fetchGreenkeepingRotations).mockResolvedValue([]);
  vi.mocked(mapApi.fetchCollaboratorMatrix).mockResolvedValue({ name: "test", entries: {} });
  useMapStore.setState({
    currentMap: { ...BASE_MAP },
    metrics: {},
    choreLists: [],
    choreListsFetched: true,
    choreListsLoading: false,
    choreListsError: null,
    greenkeepingRotations: [],
    greenkeepingRotationsFetched: true,
    greenkeepingRotationsLoading: false,
    collaboratorMatrix: { name: "test", entries: {} },
  });
});

describe('SessionOverviewView', () => {
  it('renders the overview container', () => {
    renderView();
    expect(screen.getByTestId('view-overview')).toBeInTheDocument();
    expect(screen.getByText('Session')).toBeInTheDocument();
  });

  it('renders all four card titles', () => {
    renderView();
    expect(screen.getByText('Quality Metrics')).toBeInTheDocument();
    expect(screen.getByText('Bus Matrix')).toBeInTheDocument();
    expect(screen.getByText('Chore Progress')).toBeInTheDocument();
    expect(screen.getByText('Greenkeepers')).toBeInTheDocument();
  });

  it('renders "more" links pointing to correct sub-routes', () => {
    renderView();
    expect(screen.getAllByText('more').length).toBeGreaterThanOrEqual(4);
  });

  it('shows "No metrics defined." when metrics store is empty', () => {
    renderView();
    expect(screen.getByText('No metrics defined.')).toBeInTheDocument();
  });

  it('shows metric rows when metrics are present', () => {
    useMapStore.setState({
      metrics: { m1: { id: 'm1', name: 'Availability', description: '' } },
      currentMap: {
        ...BASE_MAP,
        landmarks: {
          lm1: { id: 'lm1', name: 'Keep', ownerId: 'u1', type: 'KEEP', metrics: { m1: { metricId: 'm1', level: 'OK' } } },
        },
      },
    });
    renderView();
    expect(screen.getByText('Availability')).toBeInTheDocument();
  });

  it('shows "No chore lists." when choreLists is empty', () => {
    renderView();
    expect(screen.getByText('No chore lists.')).toBeInTheDocument();
  });

  it('shows chore list progress bars when lists are present', () => {
    useMapStore.setState({
      choreLists: [
        {
          id: 'cl1',
          title: 'Sprint 1',
          completed: false,
          entries: {
            e1: { landmarkId: 'e1', state: 'DONE', },
            e2: { landmarkId: 'e2', state: 'NONE', },
          },
        },
      ],
      choreListsFetched: true,
    });
    renderView();
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('shows "No rotations defined." when greenkeeping rotations list is empty', () => {
    renderView();
    expect(screen.getByText('No rotations defined.')).toBeInTheDocument();
  });

  it('shows rotation names and current greenkeeper when rotations are present', () => {
    useMapStore.setState({
      greenkeepingRotations: [
        {
          id: 'r1',
          name: 'Weekly Cleanup',
          groupIds: [],
          collaborators: [
            { id: 'rc1', collaboratorId: 'u1', done: false },
          ],
        },
      ],
      greenkeepingRotationsFetched: true,
    });
    renderView();
    expect(screen.getByText('Weekly Cleanup')).toBeInTheDocument();
    // keeper name and initials avatar
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AL').length).toBeGreaterThan(0);
  });

  it('shows landmark rows and collaborator header initials in Bus Matrix card', () => {
    useMapStore.setState({
      currentMap: {
        ...BASE_MAP,
        landmarks: {
          lm1: { id: 'lm1', name: 'Keep Alpha', ownerId: 'u1', type: 'KEEP' },
        },
      },
      collaboratorMatrix: { name: "test", entries: {} },
    });
    renderView();
    expect(screen.getByText('Keep Alpha')).toBeInTheDocument();
  });
});
