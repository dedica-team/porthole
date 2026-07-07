import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import Navbar from '../components/Navbar/Navbar';
import * as mapApi from '../api/mapApi';
import { useMapStore, useAuthStore } from '../store/mapStore';
import type { SessionState } from '../types/session';
vi.mock('../api/mapApi');

// ── Helpers ──────────────────────────────────────────────────────────────────

const MAP_ID = 'test-map-abc123';

const makeMap = (overrides: Partial<SessionState> = {}): SessionState => ({
  id: MAP_ID,
  createdAt: new Date().toISOString(),
  collaborators: [{ id: 'p1', username: 'alice' }],
  landmarks: {},
  connections: {},
  groups: {},
  map: { tiles: [] },
  ...overrides,
});

function renderNavbar(path = `/session/${MAP_ID}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/session/:id" element={<Navbar />} />
        <Route path="/lobby"   element={<div data-testid="lobby" />} />
        <Route path="/"        element={<Navbar />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  useMapStore.setState({
    currentMap: makeMap(),
    maps: [],
    pendingTiles: new Map(),
    selectedTile: null,
    selectedLandmark: null,
    editorMode: false,
    mainView: 'idle',
  });
  useAuthStore.setState({
    token: 'tok',
    userId: 'p1',
    username: 'alice',
    avatarUrl: null,
    isAuthenticated: true,
  });
});

// ── Join Requests ─────────────────────────────────────────────────────────────

describe('Navbar – join requests (collaborator view)', () => {
  const pendingRequest = {
    id: 'req-1',
    userId: 'u2',
    username: 'bob',
    requestedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    useMapStore.setState({
      currentMap: makeMap({ joinRequests: [pendingRequest] }),
      maps: [],
      pendingTiles: new Map(),
      selectedTile: null,
      selectedLandmark: null,
      editorMode: false,
      mainView: 'idle',
    });
    // p1 is collaborator (set in outer beforeEach)
  });

  it('shows a notification badge with pending request count', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /1 pending join request/i })).toBeInTheDocument();
  });

  it('does NOT show the badge for non-collaborators', () => {
    useMapStore.setState({
      currentMap: makeMap({
        joinRequests: [pendingRequest],
        collaborators: [{ id: 'other', username: 'other' }],
      }),
    });
    renderNavbar();
    expect(screen.queryByRole('button', { name: /pending join request/i })).not.toBeInTheDocument();
  });

  it('does NOT show the badge when there are no pending requests', () => {
    useMapStore.setState({
      currentMap: makeMap({ joinRequests: [] }),
    });
    renderNavbar();
    expect(screen.queryByRole('button', { name: /pending join request/i })).not.toBeInTheDocument();
  });

  it('opens the requests popover and shows the requester username', async () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /1 pending join request/i }));
    await waitFor(() => {
      expect(screen.getByText('Join Requests')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });
  });

  it('calls acceptJoinRequest and updates the store on Accept', async () => {
    const updatedMap = makeMap({ joinRequests: [], collaborators: [{ id: 'p1', username: 'alice' }, { id: 'u2', username: 'bob' }] });
    vi.mocked(mapApi.acceptJoinRequest).mockResolvedValue(updatedMap);

    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /1 pending join request/i }));
    await waitFor(() => screen.getByText('bob'));

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(mapApi.acceptJoinRequest).toHaveBeenCalledWith(MAP_ID, 'req-1');
      expect(useMapStore.getState().currentMap?.collaborators).toHaveLength(2);
    });
  });

  it('calls declineJoinRequest and removes the request on Decline', async () => {
    const updatedMap = makeMap({ joinRequests: [] });
    vi.mocked(mapApi.declineJoinRequest).mockResolvedValue(updatedMap);

    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /1 pending join request/i }));
    await waitFor(() => screen.getByText('bob'));

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    await waitFor(() => {
      expect(mapApi.declineJoinRequest).toHaveBeenCalledWith(MAP_ID, 'req-1');
      expect(useMapStore.getState().currentMap?.joinRequests ?? []).toHaveLength(0);
    });
  });

  it('shows an error message when acceptJoinRequest rejects', async () => {
    vi.mocked(mapApi.acceptJoinRequest).mockRejectedValue(new Error('Accept failed'));

    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /1 pending join request/i }));
    await waitFor(() => screen.getByText('bob'));
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(screen.getByText('Accept failed')).toBeInTheDocument();
    });
  });

  it('shows an error message when declineJoinRequest rejects', async () => {
    vi.mocked(mapApi.declineJoinRequest).mockRejectedValue(new Error('Decline failed'));

    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /1 pending join request/i }));
    await waitFor(() => screen.getByText('bob'));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    await waitFor(() => {
      expect(screen.getByText('Decline failed')).toBeInTheDocument();
    });
  });

  it('shows plural badge label for multiple pending requests', () => {
    const req2 = { id: 'req-2', userId: 'u3', username: 'carol', requestedAt: new Date().toISOString() };
    useMapStore.setState({
      currentMap: makeMap({ joinRequests: [pendingRequest, req2] }),
    });
    renderNavbar();
    expect(screen.getByRole('button', { name: /2 pending join requests/i })).toBeInTheDocument();
  });
});

// ── Tab navigation ──────────────────────────────────────────────────────────────────────────────
// Navigation is now route-based: each tab click calls navigate() to a sub-route.
// We verify the correct route is rendered by checking which sub-route element
// is shown after a tab click using MemoryRouter with child routes.

describe('Navbar – tab navigation', () => {
  function renderWithRoutes(initialPath = `/session/${MAP_ID}`) {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/session/:id" element={<><Navbar /><Outlet /></>}>
            <Route index element={<div data-testid="view-overview" />} />
            <Route path="map" element={<div data-testid="view-map" />} />
            <Route path="metrics" element={<div data-testid="view-metrics" />} />
            <Route path="matrix" element={<div data-testid="view-matrix" />} />
            <Route path="chores" element={<div data-testid="view-chores" />} />
            <Route path="greenkeeping" element={<div data-testid="view-greenkeeping" />} />
            <Route path="processes" element={<div data-testid="view-processes" />} />
            <Route path="editor" element={<div data-testid="view-editor" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it('renders overview view at index route', () => {
    renderWithRoutes(`/session/${MAP_ID}`);
    expect(screen.getByTestId('view-overview')).toBeInTheDocument();
  });

  it('navigates to index when Overview tab is clicked', () => {
    renderWithRoutes(`/session/${MAP_ID}/metrics`);
    fireEvent.click(screen.getByText('Overview'));
    expect(screen.getByTestId('view-overview')).toBeInTheDocument();
  });

  it('navigates to /metrics when Quality Metrics tab is clicked', () => {
    renderWithRoutes();
    fireEvent.click(screen.getByText('Quality Metrics'));
    expect(screen.getByTestId('view-metrics')).toBeInTheDocument();
  });

  it('navigates to /matrix when Bus Matrix tab is clicked', () => {
    renderWithRoutes();
    fireEvent.click(screen.getByText('Bus Matrix'));
    expect(screen.getByTestId('view-matrix')).toBeInTheDocument();
  });

  it('navigates to /chores when Chores tab is clicked', () => {
    renderWithRoutes();
    fireEvent.click(screen.getByText('Chores'));
    expect(screen.getByTestId('view-chores')).toBeInTheDocument();
  });

  it('navigates to /processes when X-Ray tab is clicked', () => {
    renderWithRoutes();
    fireEvent.click(screen.getByText('X-Ray'));
    expect(screen.getByTestId('view-processes')).toBeInTheDocument();
  });

  it('navigates back to map index when Flight mode tab is clicked from another view', () => {
    renderWithRoutes(`/session/${MAP_ID}/metrics`);
    fireEvent.click(screen.getByText('Flight mode'));
    expect(screen.getByTestId('view-map')).toBeInTheDocument();
  });

  it('deeplink to /processes sub-route renders process view', () => {
    renderWithRoutes(`/session/${MAP_ID}/processes`);
    expect(screen.getByTestId('view-processes')).toBeInTheDocument();
  });

  it('deeplink to /metrics sub-route renders metrics view', () => {
    renderWithRoutes(`/session/${MAP_ID}/metrics`);
    expect(screen.getByTestId('view-metrics')).toBeInTheDocument();
  });
});

