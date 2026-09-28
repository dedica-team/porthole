import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MapPage from '../pages/MapPage/MapPage';
import RegularMapView from '../pages/MapPage/RegularMapView';
import ProcessMapView from '../pages/MapPage/ProcessMapView';
import SessionOverviewView from '../pages/MapPage/SessionOverviewView';
import * as mapApi from '../api/mapApi';
import { useMapStore, useAuthStore } from '../store/mapStore';
import { LOADING_COPY } from '../components/ui/loadingCopy';
import type { SessionState } from '../types/session';
// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../api/mapApi');
vi.mock('../hooks/useMapWebSocket', () => ({ useMapWebSocket: vi.fn() }));
vi.mock('../pages/MapPage/SessionOverviewView', () => ({ default: () => <div data-testid="session-overview" /> }));

vi.mock('../components/HexGrid/HexGrid', () => ({
  default: ({
    onTileClick,
    brushMode,
    hideDecorations,
    onConnectionClick,
    visibleLandmarkLabelIds,
  }: {
    onTileClick: (q: number, r: number) => void;
    brushMode?: boolean;
    hideDecorations?: boolean;
    onConnectionClick?: (connectionId: string) => void;
    visibleLandmarkLabelIds?: Set<string>;
  }) => {
    const clickTile = (q: number, r: number) => {
      useMapStore.getState().setSelectedTile({ q, r });
      onTileClick(q, r);
    };
    const brushDown = (q: number, r: number) => {
      if (brushMode) onTileClick(q, r);
    };
    const brushMove = (q: number, r: number) => {
      if (brushMode) onTileClick(q, r);
    };
    return (
      <div
        data-testid="hex-grid"
        data-process-render-mode={hideDecorations ? 'true' : 'false'}
        data-visible-label-ids={visibleLandmarkLabelIds ? [...visibleLandmarkLabelIds].sort().join(',') : 'all'}
      >
        <button data-testid="tile-empty"   onClick={() => clickTile(1, 0)}>Empty Tile</button>
        <button data-testid="tile-tower"   onClick={() => clickTile(0, 0)}>Tower Tile</button>
        <button data-testid="tile-tower-2" onClick={() => clickTile(3, 0)}>Tower Tile 2</button>
        <button data-testid="tile-water"   onClick={() => clickTile(2, 0)}>Water Tile</button>
        {/* Connection click for process mode */}
        {onConnectionClick && (
          <button data-testid="conn-click" onClick={() => onConnectionClick('conn-1')}>Click Connection</button>
        )}
        {/* Brush-mode test buttons – only rendered when brushMode is active */}
        {brushMode && (
          <>
            <button data-testid="brush-down-A" onClick={() => brushDown(1, 0)}>Brush Down A</button>
            <button data-testid="brush-down-B" onClick={() => brushDown(3, 0)}>Brush Down B</button>
            <button data-testid="brush-move-C" onClick={() => brushMove(0, 0)}>Brush Move C</button>
          </>
        )}
      </div>
    );
  },
}));

// ── Fixture ───────────────────────────────────────────────────────────────────

const COLLABORATOR_ID = 'player-1';
const MAP_ID = 'game-1';

const makeMap = (overrides: Partial<SessionState> = {}): SessionState => ({
  id: MAP_ID,
  createdAt: new Date().toISOString(),
  collaborators: [{ id: COLLABORATOR_ID, username: 'test' }],
  landmarks: {
    'tower-1': { id: 'tower-1', name: 'Tower One', ownerId: COLLABORATOR_ID, coordinate: { q: 0, r: 0 }, type: 'KEEP' },
    'tower-2': { id: 'tower-2', name: 'Tower Two', ownerId: COLLABORATOR_ID, coordinate: { q: 3, r: 0 }, type: 'KEEP' },
  },
  connections: {},
  groups: {},
  map: {
    tiles: [
      { coordinate: { q: 0, r: 0 }, elevation: 3, terrain: 'ROCKS' as const, ownerId: COLLABORATOR_ID },
      { coordinate: { q: 1, r: 0 }, elevation: 4, terrain: 'ROCKS' as const, ownerId: null },
      { coordinate: { q: 2, r: 0 }, elevation: 0, terrain: 'WATER' as const, ownerId: null },
      { coordinate: { q: 3, r: 0 }, elevation: 3, terrain: 'ROCKS' as const, ownerId: COLLABORATOR_ID },
    ],
  },
  ...overrides,
});

function renderMapPage(initialPath = `/session/${MAP_ID}/map`) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/session/:id" element={<MapPage />}>
          <Route index element={<SessionOverviewView />} />
          <Route path="map" element={<RegularMapView />} />
          <Route path="processes" element={<ProcessMapView />} />
        </Route>
        <Route path="/lobby" element={<div data-testid="lobby" />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function setMapState(state: Partial<ReturnType<typeof useMapStore.getState>>) {
  await act(async () => {
    useMapStore.setState(state);
  });
}

beforeEach(() => {
  useMapStore.setState({ pendingView: null });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MapPage – landmark placement confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    useMapStore.setState({
      currentMap: makeMap(), maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    vi.mocked(mapApi.getMap).mockResolvedValue(makeMap());
    vi.mocked(mapApi.placeLandmark).mockResolvedValue(makeMap());
  });

  it('renders the hex grid', async () => {
    renderMapPage();
    await waitFor(() => expect(screen.getByTestId('hex-grid')).toBeInTheDocument());
  });

  it('shows the early loading fallback when a pending view is set', () => {
    useMapStore.setState({ currentMap: makeMap(), mainView: 'idle', pendingView: 'metrics' });
    renderMapPage();
    expect(screen.getByText(LOADING_COPY.view)).toBeInTheDocument();
  });

  it('shows TilePanel in sidebar when clicking an empty tile', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    expect(screen.getByText('Create Element')).toBeInTheDocument();
  });

  it('shows confirm message after clicking Create Landmark once', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    fireEvent.click(screen.getByText('Create Element'));
    expect(screen.getByPlaceholderText('e.g. Iron Keep')).toBeInTheDocument();
  });

  it('calls placeLandmark API after confirming', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    fireEvent.click(screen.getByText('Create Element'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Iron Keep'), { target: { value: 'Iron Keep' } });
    fireEvent.click(screen.getByText('Create Element'));
    await waitFor(() => expect(mapApi.placeLandmark).toHaveBeenCalledWith(MAP_ID, 1, 0, 'Iron Keep', 'KEEP'));
  });

  it('does not call placeLandmark after clicking Cancel', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    fireEvent.click(screen.getByText('Create Element'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(mapApi.placeLandmark).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('e.g. Iron Keep')).not.toBeInTheDocument();
  });

  it('does NOT show Create Landmark button for tile with a landmark', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    expect(screen.queryByText('Create Element')).not.toBeInTheDocument();
  });

  it('shows Create Landmark button for water tile', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-water'));
    expect(screen.getByText('Create Element')).toBeInTheDocument();
  });
});

describe('MapPage – connection flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    useMapStore.setState({
      currentMap: makeMap(), maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    vi.mocked(mapApi.getMap).mockResolvedValue(makeMap());
    vi.mocked(mapApi.createConnection).mockResolvedValue(makeMap());
  });

  it('clicking a landmark tile opens LandmarkPanel in sidebar', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    expect(screen.getByText('Tower One')).toBeInTheDocument();
    expect(screen.getByText('Create Connection')).toBeInTheDocument();
  });

  it('clicking Create Connection shows the connecting banner', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByText('Create Connection'));
    fireEvent.click(screen.getByText('Select Target'));
    expect(screen.getByText(/Click a target element to connect/)).toBeInTheDocument();
  });

  it('clicking a second landmark while connecting calls createConnection API', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByText('Create Connection'));
    fireEvent.click(screen.getByText('Select Target'));
    fireEvent.click(screen.getByTestId('tile-tower-2'));
    await waitFor(() =>
      expect(mapApi.createConnection).toHaveBeenCalledWith(MAP_ID, 'tower-1', 'tower-2', 'PIPE', undefined, undefined),
    );
  });

  it('clicking an empty tile while connecting cancels the connection mode', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByText('Create Connection'));
    fireEvent.click(screen.getByText('Select Target'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    expect(screen.queryByText(/Click a target element to connect/)).not.toBeInTheDocument();
    expect(mapApi.createConnection).not.toHaveBeenCalled();
  });

  it('pressing Escape cancels the connection mode', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByText('Create Connection'));
    fireEvent.click(screen.getByText('Select Target'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/Click a target element to connect/)).not.toBeInTheDocument();
  });
});

describe('MapPage – landscape editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    useMapStore.setState({
      currentMap: makeMap(), maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    vi.mocked(mapApi.getMap).mockResolvedValue(makeMap());
    vi.mocked(mapApi.editTile).mockResolvedValue(makeMap());
  });

  it('RAISE tool calls editTile with elevation + 1', async () => {
    useMapStore.setState({ editorMode: true, editorTool: 'RAISE', mainView: 'idle' });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    await waitFor(() => expect(mapApi.editTile).toHaveBeenCalledWith(MAP_ID, 1, 0, 5, undefined));
  });

  it('LOWER tool calls editTile with elevation - 1', async () => {
    useMapStore.setState({ editorMode: true, editorTool: 'LOWER', mainView: 'idle' });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    await waitFor(() => expect(mapApi.editTile).toHaveBeenCalledWith(MAP_ID, 1, 0, 3, undefined));
  });

  it('TERRAIN tool calls editTile with editorTerrain', async () => {
    useMapStore.setState({ editorMode: true, editorTool: 'TERRAIN', editorTerrain: 'FOREST', mainView: 'idle' });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    await waitFor(() => expect(mapApi.editTile).toHaveBeenCalledWith(MAP_ID, 1, 0, undefined, 'FOREST'));
  });

  it('normal mode is unaffected when editor is off', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    expect(mapApi.editTile).not.toHaveBeenCalled();
  });

  it('shows floating editor controls without rendering the sidebar', async () => {
    useMapStore.setState({ editorMode: true, mainView: 'idle' });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    expect(screen.getByRole('button', { name: '▲ Raise' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});

describe('MapPage – regression: no loading screen during tile edits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    useMapStore.setState({
      currentMap: makeMap(), maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: true, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    vi.mocked(mapApi.getMap).mockResolvedValue(makeMap());
    vi.mocked(mapApi.editTile).mockResolvedValue(makeMap());
  });

  it('map stays visible while editTile is in flight', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    expect(screen.getByTestId('hex-grid')).toBeInTheDocument();
    expect(screen.queryByText('Loading session')).not.toBeInTheDocument();
  });

  it('map stays visible after editTile resolves', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    await waitFor(() => expect(mapApi.editTile).toHaveBeenCalled());
    expect(screen.getByTestId('hex-grid')).toBeInTheDocument();
    expect(screen.queryByText('Loading session')).not.toBeInTheDocument();
  });
});

describe('MapPage – regression: Create Connection button visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mapApi.getMap).mockResolvedValue(makeMap());
    vi.mocked(mapApi.createConnection).mockResolvedValue(makeMap());
  });

  it('shows Create Connection when userId matches landmark ownerId', async () => {
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    useMapStore.setState({
      currentMap: makeMap(), maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    expect(screen.getByText('Create Connection')).toBeInTheDocument();
  });

  it('shows Edit and Create Connection for any collaborator regardless of ownerId', async () => {
    const mapWithBothCollabs = makeMap({
      collaborators: [
        { id: COLLABORATOR_ID, username: 'test' },
        { id: 'different-user-id', username: 'other' },
      ],
    });
    vi.mocked(mapApi.getMap).mockResolvedValue(mapWithBothCollabs);
    useAuthStore.setState({ token: 'tok', userId: 'different-user-id', username: 'other', isAuthenticated: true });
    useMapStore.setState({
      currentMap: mapWithBothCollabs,
      maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    expect(screen.getByTitle('Edit Element')).toBeInTheDocument();
    expect(screen.getByText('Create Connection')).toBeInTheDocument();
  });
});

describe('MapPage – regression: withAction applies REST response', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    useMapStore.setState({
      currentMap: makeMap(), maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    vi.mocked(mapApi.getMap).mockResolvedValue(makeMap());
  });

  it('createConnection result is reflected in the store without relying on WebSocket', async () => {
    const updated = makeMap({
      connections: { 'conn-1': { id: 'conn-1', originId: 'tower-1', targetId: 'tower-2', path: [], type: 'PIPE' as const } },
    });
    vi.mocked(mapApi.createConnection).mockResolvedValue(updated);
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByText('Create Connection'));
    fireEvent.click(screen.getByText('Select Target'));
    fireEvent.click(screen.getByTestId('tile-tower-2'));
    await waitFor(() => expect(mapApi.createConnection).toHaveBeenCalled());
    await waitFor(() =>
      expect(useMapStore.getState().currentMap?.connections).toHaveProperty('conn-1'),
    );
  });

  it('placeLandmark result is reflected in the store', async () => {
    const updated = makeMap({
      landmarks: {
        ...makeMap().landmarks,
        'new-landmark': { id: 'new-landmark', name: 'New Tower', ownerId: COLLABORATOR_ID, coordinate: { q: 1, r: 0 }, type: 'KEEP' },
      },
    });
    vi.mocked(mapApi.placeLandmark).mockResolvedValue(updated);
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    fireEvent.click(screen.getByText('Create Element'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Iron Keep'), { target: { value: 'New Tower' } });
    fireEvent.click(screen.getByText('Create Element'));
    await waitFor(() => expect(mapApi.placeLandmark).toHaveBeenCalled());
    await waitFor(() =>
      expect(useMapStore.getState().currentMap?.landmarks).toHaveProperty('new-landmark'),
    );
  });
});

// ── MapPage – remove connection ───────────────────────────────────────────────

describe('MapPage – remove connection', () => {
  const MAP_WITH_CONNECTION = makeMap({
    connections: {
      'conn-1': {
        id: 'conn-1',
        originId: 'tower-1',
        targetId: 'tower-2',
        path: [{ q: 0, r: 0 }, { q: 3, r: 0 }],
        type: 'PIPE',
        name: 'Test Pipe',
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    vi.mocked(mapApi.getMap).mockResolvedValue(MAP_WITH_CONNECTION);
    vi.mocked(mapApi.removeConnection).mockResolvedValue(makeMap({ connections: {} }));
  });

  it('shows a remove button (trash icon) next to each connection', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    // The edit button should be visible next to each connection
    expect(screen.getByTitle('Edit connection')).toBeInTheDocument();
  });

  it('clicking the edit button opens a dialog with remove option', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByTitle('Edit connection'));
    expect(screen.getByText('Remove Connection')).toBeInTheDocument();
  });

  it('clicking Remove Connection shows a confirm prompt', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByTitle('Edit connection'));
    fireEvent.click(screen.getByText('Remove Connection'));
    expect(screen.getByText('Remove this connection?')).toBeInTheDocument();
    expect(screen.getByText('Yes, remove')).toBeInTheDocument();
  });

  it('clicking Cancel on the confirm prompt hides it without calling the API', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByTitle('Edit connection'));
    fireEvent.click(screen.getByText('Remove Connection'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Remove this connection?')).not.toBeInTheDocument();
    expect(mapApi.removeConnection).not.toHaveBeenCalled();
  });

  it('confirming calls removeConnection API with the correct ids', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByTitle('Edit connection'));
    fireEvent.click(screen.getByText('Remove Connection'));
    fireEvent.click(screen.getByText('Yes, remove'));
    await waitFor(() =>
      expect(mapApi.removeConnection).toHaveBeenCalledWith(MAP_ID, 'conn-1'),
    );
  });

  it('removeConnection result is reflected in the store', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByTitle('Edit connection'));
    fireEvent.click(screen.getByText('Remove Connection'));
    fireEvent.click(screen.getByText('Yes, remove'));
    await waitFor(() => expect(mapApi.removeConnection).toHaveBeenCalled());
    await waitFor(() =>
      expect(useMapStore.getState().currentMap?.connections).not.toHaveProperty('conn-1'),
    );
  });
});

describe('MapPage – brush mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    useMapStore.setState({
      currentMap: makeMap(), maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: true, editorTool: 'TERRAIN',
      editorTerrain: 'FOREST', mainView: 'idle', confirmPending: false,
    });
    vi.mocked(mapApi.getMap).mockResolvedValue(makeMap());
    vi.mocked(mapApi.editTile).mockResolvedValue(makeMap());
  });

  it('brush buttons are only visible when editorMode is active', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    expect(screen.getByTestId('brush-down-A')).toBeInTheDocument();
  });

  it('brush buttons are not visible when editorMode is off', async () => {
    useMapStore.setState({ editorMode: false, mainView: 'idle' });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    expect(screen.queryByTestId('brush-down-A')).not.toBeInTheDocument();
  });

  it('pointerDown on a tile fires editTile immediately', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('brush-down-A'));
    await waitFor(() =>
      expect(mapApi.editTile).toHaveBeenCalledWith(MAP_ID, 1, 0, undefined, 'FOREST'),
    );
  });

  it('each new tile touched in a stroke fires a separate editTile call', async () => {
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('brush-down-A')); // tile 1,0
    fireEvent.click(screen.getByTestId('brush-move-C')); // tile 0,0
    await waitFor(() => expect(mapApi.editTile).toHaveBeenCalledTimes(2));
    expect(mapApi.editTile).toHaveBeenCalledWith(MAP_ID, 1, 0, undefined, 'FOREST');
    expect(mapApi.editTile).toHaveBeenCalledWith(MAP_ID, 0, 0, undefined, 'FOREST');
  });

  it('RAISE brush increments elevation', async () => {
    useMapStore.setState({ editorTool: 'RAISE' });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    // tile at 1,0 has elevation 4 → expect 5
    fireEvent.click(screen.getByTestId('brush-down-A'));
    await waitFor(() =>
      expect(mapApi.editTile).toHaveBeenCalledWith(MAP_ID, 1, 0, 5, undefined),
    );
  });

  it('LOWER brush decrements elevation', async () => {
    useMapStore.setState({ editorTool: 'LOWER' });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    // tile at 1,0 has elevation 4 → expect 3
    fireEvent.click(screen.getByTestId('brush-down-A'));
    await waitFor(() =>
      expect(mapApi.editTile).toHaveBeenCalledWith(MAP_ID, 1, 0, 3, undefined),
    );
  });

  it('editTile is NOT called when editorMode is off', async () => {
    useMapStore.setState({ editorMode: false, mainView: 'idle' });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    expect(mapApi.editTile).not.toHaveBeenCalled();
  });

  it('shows error message when editTile fails', async () => {
    vi.mocked(mapApi.editTile).mockRejectedValue(new Error('network error'));
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('brush-down-A'));
    await waitFor(() => expect(mapApi.editTile).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('network error')).toBeInTheDocument());
  });
});

// ── MapPage – process mode ────────────────────────────────────────────────────

describe('MapPage – process mode: processRenderMode', () => {
  const MAP_WITH_CONNECTION = makeMap({
    connections: {
      'conn-1': {
        id: 'conn-1', originId: 'tower-1', targetId: 'tower-2',
        path: [{ q: 0, r: 0 }, { q: 3, r: 0 }], type: 'PIPE' as const, name: 'Test Pipe',
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    vi.mocked(mapApi.getMap).mockResolvedValue(MAP_WITH_CONNECTION);
    vi.mocked(mapApi.fetchProcesses).mockResolvedValue([]);
  });

  it('passes processRenderMode=true to HexGrid when on /processes route', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage(`/session/${MAP_ID}/processes`);
    await waitFor(() =>
      expect(screen.getByTestId('hex-grid').dataset.processRenderMode).toBe('true'),
    );
  });

  it('passes processRenderMode=false to HexGrid when on regular map route', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    expect(screen.getByTestId('hex-grid').dataset.processRenderMode).toBe('false');
  });

  it('tile clicks do nothing (no sidebar panel) when on /processes route', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage(`/session/${MAP_ID}/processes`);
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    expect(screen.queryByText('Create Element')).not.toBeInTheDocument();
  });

  it('connection click in pick mode calls addConnectionToStage', async () => {    vi.mocked(mapApi.addConnectionToStage).mockResolvedValue([{
      id: 'proc-1', name: 'P', stages: [{
        id: 'stage-1', order: 0,
        connections: [{ id: 'sc-1', connectionId: 'conn-1', direction: 'FORWARD' as const }],
      }],
    }]);
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage(`/session/${MAP_ID}/processes`);
    await waitFor(() => screen.getByTestId('hex-grid'));
    // Set stage and pick mode after initial load
    await setMapState({
      activeProcessId: 'proc-1',
      activeStageId: 'stage-1',
      pickingConnection: true,
      processes: [{ id: 'proc-1', name: 'P', stages: [{ id: 'stage-1', order: 0, connections: [] }] }],
      processesFetched: true,
    });
    await waitFor(() => screen.getByTestId('conn-click'));
    fireEvent.click(screen.getByTestId('conn-click'));
    await waitFor(() =>
      expect(mapApi.addConnectionToStage).toHaveBeenCalledWith(MAP_ID, 'proc-1', 'stage-1', 'conn-1'),
    );
  });

  it('does NOT show New Connection button in process mode', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage(`/session/${MAP_ID}/processes`);
    await waitFor(() => screen.getByTestId('hex-grid'));
    expect(screen.queryByText('New Connection')).not.toBeInTheDocument();
  });

  it('does NOT show New Connection button when not in process mode', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    expect(screen.queryByText('New Connection')).not.toBeInTheDocument();
  });

  it('clicking a landmark tile in process mode sets selectedLandmark', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'processes', confirmPending: false,
    });
    renderMapPage(`/session/${MAP_ID}/processes`);
    await waitFor(() => screen.getByTestId('tile-tower'));
    fireEvent.click(screen.getByTestId('tile-tower'));
    await waitFor(() => {
      expect(useMapStore.getState().selectedLandmark?.id).toBe('tower-1');
    });
  });

  it('clicking an empty tile in process mode does NOT set selectedLandmark', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'processes', confirmPending: false,
    });
    renderMapPage(`/session/${MAP_ID}/processes`);
    await waitFor(() => screen.getByTestId('tile-empty'));
    fireEvent.click(screen.getByTestId('tile-empty'));
    await waitFor(() => {
      expect(useMapStore.getState().selectedLandmark).toBeNull();
    });
  });

  it('connection click outside pick mode sets selectedConnectionId', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage(`/session/${MAP_ID}/processes`);
    await waitFor(() => screen.getByTestId('hex-grid'));
    await setMapState({
      pickingConnection: false,
      activeProcessId: null,
      activeStageId: null,
      processesFetched: true,
    });
    await waitFor(() => screen.getByTestId('conn-click'));
    fireEvent.click(screen.getByTestId('conn-click'));
    await waitFor(() => {
      expect(useMapStore.getState().selectedConnectionId).toBe('conn-1');
    });
    expect(mapApi.addConnectionToStage).not.toHaveBeenCalled();
  });
});

// ── MapPage – landmark search field ──────────────────────────────────────────

describe('MapPage – landmark search field', () => {
  const MAP_WITH_CONNECTION = makeMap({
    connections: {
      'conn-1': {
        id: 'conn-1', originId: 'tower-1', targetId: 'tower-2',
        path: [{ q: 0, r: 0 }, { q: 3, r: 0 }], type: 'PIPE' as const,
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    vi.mocked(mapApi.getMap).mockResolvedValue(MAP_WITH_CONNECTION);
    vi.mocked(mapApi.fetchProcesses).mockResolvedValue([]);
  });

  it('search input is visible in normal mode', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    expect(screen.getByPlaceholderText('Locate…')).toBeInTheDocument();
  });

  it('search input is visible in process mode', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'processes', confirmPending: false,
    });
    renderMapPage(`/session/${MAP_ID}/processes`);
    await waitFor(() => expect(screen.getByPlaceholderText('Locate…')).toBeInTheDocument());
  });

  it('typing filters landmarks and shows dropdown', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.change(screen.getByPlaceholderText('Locate…'), { target: { value: 'tower' } });
    await waitFor(() => expect(screen.getByText('Tower One')).toBeInTheDocument());
  });

  it('selecting a result sets selectedTile, selectedLandmark and mainView', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'idle', confirmPending: false,
    });
    renderMapPage();
    await waitFor(() => screen.getByTestId('hex-grid'));
    fireEvent.change(screen.getByPlaceholderText('Locate…'), { target: { value: 'tower one' } });
    const result = await screen.findByText('Tower One');
    fireEvent.mouseDown(result);
    await waitFor(() => {
      const state = useMapStore.getState();
      expect(state.selectedTile).toEqual({ q: 0, r: 0 });
      expect(state.selectedLandmark?.id).toBe('tower-1');
      expect(state.mainView).toBe('landmark');
    });
  });

  it('in process mode, search sets selectedTile but does NOT change mainView', async () => {
    useMapStore.setState({
      currentMap: MAP_WITH_CONNECTION, maps: [], selectedTile: null, selectedLandmark: null,
      connectingFromLandmarkId: null, editorMode: false, editorTool: 'RAISE',
      editorTerrain: 'GRASS', mainView: 'processes', confirmPending: false,
    });
    renderMapPage(`/session/${MAP_ID}/processes`);
    await waitFor(() => screen.getByPlaceholderText('Locate…'));
    fireEvent.change(screen.getByPlaceholderText('Locate…'), { target: { value: 'tower one' } });
    const result = await screen.findByRole('button', { name: /tower one/i });
    fireEvent.mouseDown(result);
    await waitFor(() => {
      const state = useMapStore.getState();
      expect(state.selectedTile).toEqual({ q: 0, r: 0 });
      expect(state.mainView).toBe('processes'); // handleLandmarkSearch does not call setMainView
    });
  });
});

// ── visibleLandmarkLabelIds ───────────────────────────────────────────────────

const PROCESS_LANDMARKS: SessionState['landmarks'] = {
  'lm-1': { id: 'lm-1', name: 'Alpha', ownerId: COLLABORATOR_ID, coordinate: { q: 0, r: 0 }, type: 'KEEP' },
  'lm-2': { id: 'lm-2', name: 'Beta',  ownerId: COLLABORATOR_ID, coordinate: { q: 1, r: 0 }, type: 'KEEP' },
  'lm-3': { id: 'lm-3', name: 'Gamma', ownerId: COLLABORATOR_ID, coordinate: { q: 2, r: 0 }, type: 'KEEP' },
};

const PROCESS_CONNECTIONS: SessionState['connections'] = {
  'conn-1': { id: 'conn-1', name: 'A→B', originId: 'lm-1', targetId: 'lm-2', type: 'PIPE', path: [] },
  'conn-2': { id: 'conn-2', name: 'B→C', originId: 'lm-2', targetId: 'lm-3', type: 'PIPE', path: [] },
};

const PROCESSES = [
  {
    id: 'proc-1',
    name: 'My Process',
    description: '',
    stages: [
      { id: 'stage-1', name: 'Stage A', order: 1, connections: [{ id: 'sc-1', connectionId: 'conn-1', direction: 'FORWARD' as const }] },
      { id: 'stage-2', name: 'Stage B', order: 2, connections: [{ id: 'sc-2', connectionId: 'conn-2', direction: 'FORWARD' as const }] },
    ],
  },
];

function labelIds() {
  return screen.getByTestId('hex-grid').dataset.visibleLabelIds;
}

describe('ProcessMapView – visibleLandmarkLabelIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', userId: COLLABORATOR_ID, username: 'test', isAuthenticated: true });
    useMapStore.setState({
      currentMap: makeMap({ landmarks: PROCESS_LANDMARKS, connections: PROCESS_CONNECTIONS }),
      maps: [],
      processes: PROCESSES,
      processSidebarHidden: true,
      activeProcessId: null,
      activeStageId: null,
      pendingView: null,
    });
  });

  afterEach(() => {
    useMapStore.setState({ activeProcessId: null, activeStageId: null });
  });

  it('passes all labels (undefined) when no process is active', async () => {
    renderMapPage(`/session/${MAP_ID}/processes`);
    await screen.findByTestId('hex-grid');
    expect(labelIds()).toBe('all');
  });

  it('shows all landmarks in the process when a process is active but no stage', async () => {
    renderMapPage(`/session/${MAP_ID}/processes`);
    await screen.findByTestId('hex-grid');
    await setMapState({ activeProcessId: 'proc-1', activeStageId: null });
    expect(labelIds()).toBe('lm-1,lm-2,lm-3');
  });

  it('shows only stage-1 endpoints when stage-1 is active', async () => {
    renderMapPage(`/session/${MAP_ID}/processes`);
    await screen.findByTestId('hex-grid');
    await setMapState({ activeProcessId: 'proc-1', activeStageId: 'stage-1' });
    expect(labelIds()).toBe('lm-1,lm-2');
  });

  it('shows only stage-2 endpoints when stage-2 is active', async () => {
    renderMapPage(`/session/${MAP_ID}/processes`);
    await screen.findByTestId('hex-grid');
    await setMapState({ activeProcessId: 'proc-1', activeStageId: 'stage-2' });
    expect(labelIds()).toBe('lm-2,lm-3');
  });

  it('reverts to all labels when the process is deselected', async () => {
    renderMapPage(`/session/${MAP_ID}/processes`);
    await screen.findByTestId('hex-grid');
    await setMapState({ activeProcessId: 'proc-1', activeStageId: 'stage-1' });
    expect(labelIds()).toBe('lm-1,lm-2');
    await setMapState({ activeProcessId: null, activeStageId: null });
    expect(labelIds()).toBe('all');
  });
});

