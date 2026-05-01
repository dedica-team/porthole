import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LobbyPage from '../pages/LobbyPage/LobbyPage';
import * as mapApi from '../api/mapApi';
import { useMapStore, useAuthStore } from '../store/mapStore';
import type { SessionState } from '../types/session';
// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../api/mapApi');

vi.mock('../components/AppShell/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const MAP_ID  = 'map-123';

const makeMap = (overrides: Partial<SessionState> = {}): SessionState => ({
  id: MAP_ID,
  createdAt: new Date().toISOString(),
  collaborators: [],
  landmarks: {},
  connections: {},
  groups: {},
  map: { tiles: [] },
  ...overrides,
});

function renderLobbyPage() {
  return render(
    <MemoryRouter initialEntries={['/lobby']}>
      <Routes>
        <Route path="/lobby"    element={<LobbyPage />} />
        <Route path="/map/:id"  element={<div data-testid="map-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  useAuthStore.setState({
    token: 'tok',
    userId: USER_ID,
    username: 'alice',
    avatarUrl: null,
    isAuthenticated: true,
  });

  useMapStore.setState({
    maps: [],
    currentMap: null,
    pendingTiles: new Map(),
    selectedTile: null,
    selectedLandmark: null,
    editorMode: false,
    mainView: 'idle',
  });

  vi.mocked(mapApi.listMaps).mockResolvedValue([]);
});

// ── OPEN map: clicking Join directly joins ────────────────────────────────────

describe('LobbyPage – OPEN map', () => {
  it('calls joinMap directly without dialog when mode is OPEN', async () => {
    const openMap = makeMap({ collaborationMode: 'OPEN', name: 'Open World' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([openMap]);
    vi.mocked(mapApi.joinMap).mockResolvedValue({ ...openMap, collaborators: [{ id: USER_ID, username: 'alice' }] });

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('Open World')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));

    await waitFor(() => expect(mapApi.joinMap).toHaveBeenCalledWith(MAP_ID));
    expect(mapApi.requestJoin).not.toHaveBeenCalled();
    // navigates to map page
    await waitFor(() => expect(screen.getByTestId('map-page')).toBeInTheDocument());
  });

  it('shows an error alert when joinMap rejects', async () => {
    const openMap = makeMap({ collaborationMode: 'OPEN', name: 'Open World' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([openMap]);
    vi.mocked(mapApi.joinMap).mockRejectedValue(new Error('Server error'));

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('Open World')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));

    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });
});

// ── REQUEST map: clicking Join shows a confirmation dialog ────────────────────

describe('LobbyPage – REQUEST map (non-collaborator)', () => {
  it('opens the confirmation dialog instead of joining immediately', async () => {
    const requestMap = makeMap({ collaborationMode: 'REQUEST', name: 'Members Only' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([requestMap]);

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('Members Only')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));

    expect(screen.getByRole('heading', { name: /request to join/i })).toBeInTheDocument();
    // map name appears in both the list and the dialog
    expect(screen.getAllByText(/Members Only/).length).toBeGreaterThanOrEqual(1);
    expect(mapApi.joinMap).not.toHaveBeenCalled();
    expect(mapApi.requestJoin).not.toHaveBeenCalled();
  });

  it('dialog mentions the map name', async () => {
    const requestMap = makeMap({ collaborationMode: 'REQUEST', name: 'Secret Atlas' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([requestMap]);

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('Secret Atlas')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));

    // The dialog contains the map name in a <strong> element
    expect(screen.getByRole('heading', { name: /request to join/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Secret Atlas/).length).toBeGreaterThanOrEqual(1);
  });

  it('closes the dialog when Cancel is clicked without sending a request', async () => {
    const requestMap = makeMap({ collaborationMode: 'REQUEST', name: 'Members Only' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([requestMap]);

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('Members Only')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));

    expect(screen.getByRole('heading', { name: /request to join/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /request to join/i })).not.toBeInTheDocument(),
    );
    expect(mapApi.requestJoin).not.toHaveBeenCalled();
  });

  it('calls requestJoin on confirm and shows "Request sent" badge', async () => {
    const requestMap = makeMap({ collaborationMode: 'REQUEST', name: 'Members Only' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([requestMap]);
    vi.mocked(mapApi.requestJoin).mockResolvedValue(requestMap);

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('Members Only')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));

    const sendBtn = screen.getByRole('button', { name: /send request/i });
    fireEvent.click(sendBtn);

    await waitFor(() => expect(mapApi.requestJoin).toHaveBeenCalledWith(MAP_ID));

    // dialog closed
    expect(screen.queryByRole('heading', { name: /request to join/i })).not.toBeInTheDocument();
    // join button replaced by pending status badge
    expect(screen.getByText(/request pending/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /join as collaborator/i })).not.toBeInTheDocument();
    // should NOT have navigated away
    expect(screen.queryByTestId('map-page')).not.toBeInTheDocument();
  });

  it('does not navigate to the map page after sending a join request', async () => {
    const requestMap = makeMap({ collaborationMode: 'REQUEST', name: 'Members Only' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([requestMap]);
    vi.mocked(mapApi.requestJoin).mockResolvedValue(requestMap);

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('Members Only')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(mapApi.requestJoin).toHaveBeenCalled());
    expect(screen.queryByTestId('map-page')).not.toBeInTheDocument();
  });

  it('shows an error alert when requestJoin fails', async () => {
    const requestMap = makeMap({ collaborationMode: 'REQUEST', name: 'Members Only' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([requestMap]);
    vi.mocked(mapApi.requestJoin).mockRejectedValue(new Error('Already requested'));

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('Members Only')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(screen.getByText('Already requested')).toBeInTheDocument());
  });

  it('closes the dialog when the X button is clicked', async () => {
    const requestMap = makeMap({ collaborationMode: 'REQUEST', name: 'Members Only' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([requestMap]);

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('Members Only')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));

    expect(screen.getByRole('heading', { name: /request to join/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /request to join/i })).not.toBeInTheDocument(),
    );
  });
});

// ── PRIVATE map: Join button not shown for non-collaborators ──────────────────

describe('LobbyPage – PRIVATE map', () => {
  it('calls joinMap directly for PRIVATE maps (server enforces access)', async () => {
    const privateMap = makeMap({ collaborationMode: 'PRIVATE', name: 'Private Island' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([privateMap]);
    vi.mocked(mapApi.joinMap).mockRejectedValue(new Error('Access denied'));

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('Private Island')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));

    await waitFor(() => expect(mapApi.joinMap).toHaveBeenCalledWith(MAP_ID));
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });
});

// ── Collaborator does not see Join button ─────────────────────────────────────

describe('LobbyPage – already a collaborator', () => {
  it('does not render the Join button when the user is already a collaborator', async () => {
    const myMap = makeMap({
      collaborationMode: 'REQUEST',
      name: 'My Map',
      collaborators: [{ id: USER_ID, username: 'alice' }],
    });
    vi.mocked(mapApi.listMaps).mockResolvedValue([myMap]);

    renderLobbyPage();

    await waitFor(() => expect(screen.getByText('My Map')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /join as collaborator/i })).not.toBeInTheDocument();
  });
});

