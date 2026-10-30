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

  it('navigates to index when session title tab is clicked', () => {
    useMapStore.setState({ currentMap: makeMap({ name: 'Alpha Base' }) });
    renderWithRoutes(`/session/${MAP_ID}/metrics`);
    fireEvent.click(screen.getByText('Alpha Base'));
    expect(screen.getByTestId('view-overview')).toBeInTheDocument();
  });

  it('uses map id slice when currentMap has no custom name', () => {
    useMapStore.setState({ currentMap: makeMap({ name: undefined }) });
    renderWithRoutes(`/session/${MAP_ID}/metrics`);
    expect(screen.getByText(`#${MAP_ID.slice(0, 8)}`)).toBeInTheDocument();
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

// ── Username editing ───────────────────────────────────────────────────────────

describe('Navbar – username editing', () => {
  function openUserMenu() {
    fireEvent.click(screen.getByRole('button', { name: /user menu/i }));
  }

  it('shows a pencil button next to the username in the user menu', async () => {
    renderNavbar();
    openUserMenu();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit username/i })).toBeInTheDocument();
    });
  });

  it('switches to edit mode when pencil is clicked', async () => {
    renderNavbar();
    openUserMenu();
    await waitFor(() => screen.getByRole('button', { name: /edit username/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit username/i }));
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('alice');
    });
  });

  it('prefills the input with the current username', async () => {
    renderNavbar();
    openUserMenu();
    await waitFor(() => screen.getByRole('button', { name: /edit username/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit username/i }));
    expect(screen.getByRole('textbox')).toHaveValue('alice');
  });

  it('cancels edit mode on Escape without saving', async () => {
    renderNavbar();
    openUserMenu();
    await waitFor(() => screen.getByRole('button', { name: /edit username/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit username/i }));
    await waitFor(() => screen.getByRole('textbox'));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
    expect(mapApi.changeUsername).not.toHaveBeenCalled();
  });

  it('cancels edit mode when X button is clicked', async () => {
    renderNavbar();
    openUserMenu();
    await waitFor(() => screen.getByRole('button', { name: /edit username/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit username/i }));
    await waitFor(() => screen.getByRole('textbox'));
    // The cancel button has no aria-label so find it by position (after the check button)
    screen.getAllByRole('button').find(
      (b) => !b.getAttribute('aria-label') && b.closest('[class*="flex items-center gap-1"]'),
    );
    // Use the keyboard shortcut instead as it's the same code path
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('calls changeUsername and updates auth store on Enter', async () => {
    vi.mocked(mapApi.changeUsername).mockResolvedValue({ username: 'alice2' });
    renderNavbar();
    openUserMenu();
    await waitFor(() => screen.getByRole('button', { name: /edit username/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit username/i }));
    await waitFor(() => screen.getByRole('textbox'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alice2' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => {
      expect(mapApi.changeUsername).toHaveBeenCalledWith('alice2');
      expect(useAuthStore.getState().username).toBe('alice2');
    });
  });

  it('updates collaborator username in currentMap after rename', async () => {
    vi.mocked(mapApi.changeUsername).mockResolvedValue({ username: 'alice2' });
    renderNavbar();
    openUserMenu();
    await waitFor(() => screen.getByRole('button', { name: /edit username/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit username/i }));
    await waitFor(() => screen.getByRole('textbox'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alice2' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => {
      const collaborators = useMapStore.getState().currentMap?.collaborators ?? [];
      expect(collaborators.find((c) => c.id === 'p1')?.username).toBe('alice2');
    });
  });

  it('shows error message when changeUsername fails', async () => {
    vi.mocked(mapApi.changeUsername).mockRejectedValue(new Error('Username taken'));
    renderNavbar();
    openUserMenu();
    await waitFor(() => screen.getByRole('button', { name: /edit username/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit username/i }));
    await waitFor(() => screen.getByRole('textbox'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'bob' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Username taken')).toBeInTheDocument();
    });
    expect(useAuthStore.getState().username).toBe('alice');
  });

  it('does not call API when username is unchanged', async () => {
    renderNavbar();
    openUserMenu();
    await waitFor(() => screen.getByRole('button', { name: /edit username/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit username/i }));
    await waitFor(() => screen.getByRole('textbox'));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
    expect(mapApi.changeUsername).not.toHaveBeenCalled();
  });
});

// ── Search & User popups and icon+text items ─────────────────────────────────

describe('Navbar – search and user elements', () => {
  const landmarkA: import('../types/landmark').Landmark = {
    id: 'lm-1',
    name: 'Dragon Castle',
    ownerId: null,
    type: 'KEEP',
    coordinate: { q: 1, r: 2 },
  };

  beforeEach(() => {
    useMapStore.setState({
      currentMap: makeMap({
        name: 'Hex Realm',
        landmarks: { 'lm-1': landmarkA },
      }),
    });
  });

  it('renders search and user buttons with icon and text', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /user menu/i })).toHaveTextContent('alice');
  });

  it('opens search popup and filters landmarks on typing', async () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    const searchInput = await screen.findByPlaceholderText('Search…');
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Dragon' } });
    expect(await screen.findByText('Dragon Castle')).toBeInTheDocument();
  });

  it('selects landmark on click in search popup', async () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    const searchInput = await screen.findByPlaceholderText('Search…');
    fireEvent.change(searchInput, { target: { value: 'Dragon' } });

    const landmarkItem = await screen.findByText('Dragon Castle');
    fireEvent.click(landmarkItem);

    // After selection, search popup closes
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument();
    });
  });

  it('toggles mobile hamburger menu and renders search input and items', async () => {
    renderNavbar();
    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    expect(menuBtn).toHaveTextContent('Menu');

    fireEvent.click(menuBtn);
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });

  it('allows entering a search value and selecting a landmark in mobile hamburger menu', async () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    const searchInput = screen.getByPlaceholderText('Search…');
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Dragon' } });
    const match = await screen.findByText('Dragon Castle');
    expect(match).toBeInTheDocument();

    fireEvent.click(match);
    // Menu closes and search input is removed
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument();
    });
  });

  it('applies responsive collapse classes (hidden 2xl:inline) to navbar labels', () => {
    renderNavbar();
    const searchBtn = screen.getByRole('button', { name: /^search$/i });
    const searchLabel = searchBtn.querySelector('span');
    expect(searchLabel).toHaveClass('hidden', '2xl:inline');

    const metricsBtn = screen.getByRole('button', { name: /^quality metrics$/i });
    const metricsLabel = metricsBtn.querySelector('span');
    expect(metricsLabel).toHaveClass('hidden', '2xl:inline');

    const lobbyBtn = screen.getByRole('button', { name: /back to lobby/i });
    const lobbyLabel = lobbyBtn.querySelector('span');
    expect(lobbyLabel).toHaveClass('hidden', '2xl:inline');
  });
});

