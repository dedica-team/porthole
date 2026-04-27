/**
 * Cursor-pointer tests for real views.
 *
 * Every interactive button in the app must carry the `cursor-pointer` Tailwind
 * class so users get the expected pointer cursor on hover.  Tests render the
 * actual views (no mocked button stubs) and assert that every <button> element
 * has the class.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthPage from '../pages/AuthPage/AuthPage';
import LobbyPage from '../pages/LobbyPage/LobbyPage';
import Navbar from '../components/Navbar/Navbar';
import * as mapApi from '../api/mapApi';
import { useMapStore, useAuthStore } from '../store/mapStore';
import type { MapState } from '../types/map';

vi.mock('../api/mapApi');
vi.mock('../components/AppShell/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const MAP_ID = 'map-cursor-test';

const makeMap = (overrides: Partial<MapState> = {}): MapState => ({
  id: MAP_ID,
  createdAt: new Date().toISOString(),
  collaborators: [{ id: 'u1', username: 'alice' }],
  landmarks: {},
  connections: {},
  groups: {},
  metrics: {},
  map: { tiles: [] },
  ...overrides,
});

function allButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll('button'));
}

function assertAllHaveCursorPointer(container: HTMLElement) {
  const buttons = allButtons(container);
  expect(buttons.length).toBeGreaterThan(0);
  for (const btn of buttons) {
    expect(
      btn.className,
      `Button "${btn.textContent?.trim() || btn.getAttribute('aria-label') || '(no label)'}" is missing cursor-pointer`,
    ).toContain('cursor-pointer');
  }
}

// ── AuthPage ──────────────────────────────────────────────────────────────────

describe('AuthPage – all buttons have cursor-pointer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: null, userId: null, username: null, avatarUrl: null, isAuthenticated: false });
    vi.mocked(mapApi.getAuthFeatures).mockResolvedValue({ githubEnabled: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ githubClientId: 'gh-id' }),
      text: async () => '',
    }));
  });

  it('GitHub button has cursor-pointer', async () => {
    render(
      <MemoryRouter><Routes><Route path="/" element={<AuthPage />} /></Routes></MemoryRouter>,
    );
    const btn = await screen.findByRole('button', { name: /access via github/i });
    expect(btn.className).toContain('cursor-pointer');
  });

  it('Passkey button has cursor-pointer when WebAuthn is supported', () => {
    vi.stubGlobal('PublicKeyCredential', class {});
    render(
      <MemoryRouter><Routes><Route path="/" element={<AuthPage />} /></Routes></MemoryRouter>,
    );
    const btn = screen.getByRole('button', { name: /sign in with passkey/i });
    expect(btn.className).toContain('cursor-pointer');
  });

  it('passkey modal Close button has cursor-pointer', async () => {
    vi.stubGlobal('PublicKeyCredential', class {});
    vi.mocked(mapApi.webauthnAuthStart).mockRejectedValue(
      Object.assign(new DOMException('cancelled', 'NotAllowedError')),
    );
    const { container } = render(
      <MemoryRouter><Routes><Route path="/" element={<AuthPage />} /></Routes></MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /sign in with passkey/i }));
    await waitFor(() => screen.getByRole('button', { name: /close/i }));
    assertAllHaveCursorPointer(container);
  });
});

// ── LobbyPage ─────────────────────────────────────────────────────────────────

describe('LobbyPage – all buttons have cursor-pointer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: 'u1', username: 'alice', avatarUrl: null, isAuthenticated: true });
    useMapStore.setState({ maps: [], currentMap: null, pendingTiles: new Map(), selectedTile: null, selectedLandmark: null, editorMode: false, mainView: 'idle' });
    vi.mocked(mapApi.listMaps).mockResolvedValue([]);
  });

  function renderLobby() {
    return render(
      <MemoryRouter initialEntries={['/lobby']}>
        <Routes>
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/map/:id" element={<div />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('"New Session" button has cursor-pointer', async () => {
    const { container } = renderLobby();
    await waitFor(() => screen.getByRole('button', { name: /new session/i }));
    assertAllHaveCursorPointer(container);
  });

  it('New Session dialog buttons all have cursor-pointer', async () => {
    const { container } = renderLobby();
    await waitFor(() => screen.getByRole('button', { name: /new session/i }));
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    await waitFor(() => screen.getByRole('button', { name: /close/i }));
    assertAllHaveCursorPointer(container);
  });

  it('Join button has cursor-pointer', async () => {
    vi.mocked(mapApi.listMaps).mockResolvedValue([makeMap({ collaborationMode: 'OPEN', name: 'Open Map', collaborators: [] })]);
    const { container } = renderLobby();
    await waitFor(() => screen.getByRole('button', { name: /join as collaborator/i }));
    assertAllHaveCursorPointer(container);
  });

  it('Join Request dialog buttons all have cursor-pointer', async () => {
    vi.mocked(mapApi.listMaps).mockResolvedValue([makeMap({ collaborationMode: 'REQUEST', name: 'Req Map', collaborators: [] })]);
    const { container } = renderLobby();
    await waitFor(() => screen.getByRole('button', { name: /join as collaborator/i }));
    fireEvent.click(screen.getByRole('button', { name: /join as collaborator/i }));
    await waitFor(() => screen.getByRole('button', { name: /send request/i }));
    assertAllHaveCursorPointer(container);
  });
});

// ── Navbar ────────────────────────────────────────────────────────────────────

describe('Navbar – all buttons have cursor-pointer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: 'u1', username: 'alice', avatarUrl: null, isAuthenticated: true });
    useMapStore.setState({
      currentMap: makeMap(),
      maps: [],
      pendingTiles: new Map(),
      selectedTile: null,
      selectedLandmark: null,
      editorMode: false,
      mainView: 'idle',
    });
  });

  function renderNavbar() {
    return render(
      <MemoryRouter initialEntries={[`/map/${MAP_ID}`]}>
        <Routes>
          <Route path="/map/:id" element={<Navbar />} />
          <Route path="/lobby" element={<div />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('logo button has cursor-pointer', () => {
    const { container } = renderNavbar();
    assertAllHaveCursorPointer(container);
  });

  it('map settings popover buttons all have cursor-pointer', async () => {
    const { container } = renderNavbar();
    fireEvent.click(screen.getByText(`#${MAP_ID.slice(0, 8)}`));
    await waitFor(() => screen.getByRole('button', { name: /save/i }));
    assertAllHaveCursorPointer(container);
  });
});

