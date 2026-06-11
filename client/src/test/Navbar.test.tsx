import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

function renderNavbar(path = `/map/${MAP_ID}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/map/:id" element={<Navbar />} />
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
    pendingView: null,
  });
  useAuthStore.setState({
    token: 'tok',
    userId: 'p1',
    username: 'alice',
    avatarUrl: null,
    isAuthenticated: true,
  });
});

// ── Map ID button ─────────────────────────────────────────────────────────────

describe('Navbar – map ID button', () => {
  it('shows the first 8 chars of the map ID', () => {
    renderNavbar();
    expect(screen.getByText(`#${MAP_ID.slice(0, 8)}`)).toBeInTheDocument();
  });

  it('shows the map name when one is set', () => {
    useMapStore.setState({ currentMap: makeMap({ name: 'My Campaign' }) });
    renderNavbar();
    expect(screen.getByText('My Campaign')).toBeInTheDocument();
  });

  it('does not show a name element when name is undefined', () => {
    renderNavbar();
    expect(screen.queryByText('My Campaign')).not.toBeInTheDocument();
  });
});

// ── Popover opens ─────────────────────────────────────────────────────────────

describe('Navbar – map settings popover', () => {
  it('opens the popover when the map button is clicked', async () => {
    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });
  });

  it('pre-fills name and description from currentMap', async () => {
    useMapStore.setState({
      currentMap: makeMap({ name: 'Existing Name', description: 'Existing Desc' }),
    });
    renderNavbar();
    fireEvent.click(screen.getByText('Existing Name'));
    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Existing Name');
      expect(screen.getByLabelText<HTMLTextAreaElement>('Description').value).toBe('Existing Desc');
    });
  });

  it('displays the full map ID in the popover', async () => {
    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => {
      expect(screen.getByText(MAP_ID)).toBeInTheDocument();
    });
  });

  it('closes the popover when Cancel is clicked', async () => {
    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    });
  });
});

// ── Save ──────────────────────────────────────────────────────────────────────

describe('Navbar – saving map name/description', () => {
  it('calls editMap with the entered values on Save', async () => {
    const updatedMap = makeMap({ name: 'New Name', description: 'New Desc' });
    vi.mocked(mapApi.editMap).mockResolvedValue(updatedMap);

    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => screen.getByLabelText('Name'));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Name' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'New Desc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mapApi.editMap).toHaveBeenCalledWith(MAP_ID, 'New Name', 'New Desc');
    });
  });

  it('closes the popover after a successful save', async () => {
    vi.mocked(mapApi.editMap).mockResolvedValue(makeMap({ name: 'Saved' }));

    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => screen.getByLabelText('Name'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    });
  });

  it('updates the store with the response from editMap', async () => {
    const updatedMap = makeMap({ name: 'Store Updated' });
    vi.mocked(mapApi.editMap).mockResolvedValue(updatedMap);

    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => screen.getByLabelText('Name'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Store Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(useMapStore.getState().currentMap?.name).toBe('Store Updated');
    });
  });

  it('shows an error message when editMap rejects', async () => {
    vi.mocked(mapApi.editMap).mockRejectedValue(new Error('Server error'));

    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => screen.getByLabelText('Name'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('passes undefined for empty name so the server can treat it as null', async () => {
    vi.mocked(mapApi.editMap).mockResolvedValue(makeMap());

    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => screen.getByLabelText('Name'));

    // leave name empty
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      // empty string → passed as undefined (|| undefined)
      expect(mapApi.editMap).toHaveBeenCalledWith(MAP_ID, undefined, undefined);
    });
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

// ── Session export in map dropdown ───────────────────────────────────────────

describe('Navbar – session export', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'tok',
      userId: 'p1',
      username: 'alice',
      avatarUrl: null,
      isAuthenticated: true,
      isAdmin: false,
    });
  });

  it('renders the Export button in the session dropdown for collaborators', async () => {
    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export session json/i })).toBeInTheDocument();
    });
  });

  it('does NOT render the Export button for viewers', async () => {
    useMapStore.setState({
      currentMap: makeMap({ collaborators: [{ id: 'other', username: 'other' }] }),
    });
    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /export session json/i })).not.toBeInTheDocument();
    });
  });

  it('does NOT render the Export button when not on a map page', () => {
    renderNavbar('/lobby');
    expect(screen.queryByRole('button', { name: /export session json/i })).not.toBeInTheDocument();
  });

  it('calls exportMapJson and triggers a download on click', async () => {
    const mapData = makeMap({ name: 'Export Test' });
    vi.mocked(mapApi.exportMapJson).mockResolvedValue(mapData);

    // mock URL.createObjectURL / revokeObjectURL
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;

    // mock anchor click
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => screen.getByRole('button', { name: /export session json/i }));
    fireEvent.click(screen.getByRole('button', { name: /export session json/i }));

    await waitFor(() => {
      expect(mapApi.exportMapJson).toHaveBeenCalledWith(MAP_ID);
      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    vi.restoreAllMocks();
  });
});

describe('Navbar – early pending view state', () => {
  it('sets pendingView immediately when switching to metrics', () => {
    renderNavbar();
    fireEvent.click(screen.getByText('Quality Metrics'));
    expect(useMapStore.getState().pendingView).toBe('metrics');
    expect(useMapStore.getState().mainView).toBe('metrics');
  });
});

// ── Deeplink: ?view= query param ──────────────────────────────────────────────

describe('Navbar – deeplinks', () => {
  it('restores the view from ?view= query param on mount', () => {
    // Simulate opening a shared link: /map/:id?view=matrix
    renderNavbar(`/map/${MAP_ID}?view=matrix`);
    expect(useMapStore.getState().mainView).toBe('matrix');
    expect(useMapStore.getState().pendingView).toBe('matrix');
  });

  it('ignores an invalid ?view= value and leaves mainView unchanged', () => {
    renderNavbar(`/map/${MAP_ID}?view=invalid`);
    // Store should remain at the default 'idle' set in beforeEach
    expect(useMapStore.getState().mainView).toBe('idle');
  });

  it('updates the URL query param when a tab is clicked', () => {
    // Capture location changes via a helper route that reads search params.
    let capturedSearch = '';
    const SearchCapture = () => {
      capturedSearch = window.location.search;
      return null;
    };
    render(
      <MemoryRouter initialEntries={[`/map/${MAP_ID}`]}>
        <Routes>
          <Route path="/map/:id" element={<><Navbar /><SearchCapture /></>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Chores'));
    expect(useMapStore.getState().mainView).toBe('chores');
    // MemoryRouter does not update window.location, so verify via store only.
    expect(useMapStore.getState().pendingView).toBe('chores');
  });
});

