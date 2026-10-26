import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditorPanel from '../components/Sidebar/panels/EditorPanel';
import * as mapApi from '../api/mapApi';
import { useMapStore, useAuthStore } from '../store/mapStore';
import type { SessionState } from '../types/session';

vi.mock('../api/mapApi');

const MAP_ID = 'test-map-editor-123';

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

describe('EditorPanel (LandscapeEditor replacement)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({
      editorTool: 'RAISE',
      editorTerrain: 'GRASS',
      selectedTile: null,
      currentMap: makeMap(),
    });
    useAuthStore.setState({
      userId: 'p1',
      username: 'alice',
      isAdmin: false,
    });
  });

  it('shows all tools including none', () => {
    render(<EditorPanel />);
    expect(screen.getByText('✋ None')).toBeInTheDocument();
    expect(screen.getByText('▲ Raise')).toBeInTheDocument();
    expect(screen.getByText('▼ Lower')).toBeInTheDocument();
    expect(screen.getByText('🎨 Terrain')).toBeInTheDocument();
  });

  it('allows selecting none tool to disable click actions', () => {
    render(<EditorPanel />);
    fireEvent.click(screen.getByText('✋ None'));
    expect(useMapStore.getState().editorTool).toBe('NONE');
  });

  it('terrain buttons hidden when tool is not TERRAIN', () => {
    render(<EditorPanel />);
    expect(screen.queryByText('🌿 Grass')).not.toBeInTheDocument();
  });

  it('renders right side overlay panels similar to xray overlays', () => {
    const { container } = render(<EditorPanel />);
    const panelContainer = container.querySelector('.absolute.top-2.right-3');
    expect(panelContainer).toBeInTheDocument();
    expect(screen.getByText('Landscape')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✋ None' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '▲ Raise' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '▼ Lower' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🎨 Terrain' })).toBeInTheDocument();
  });

  it('renders terrain types palette when TERRAIN tool is selected and updates store', () => {
    useMapStore.setState({ editorTool: 'TERRAIN', editorTerrain: 'GRASS' });
    render(<EditorPanel />);
    expect(screen.getByText('Terrain Type')).toBeInTheDocument();
    expect(screen.getByText('💧 Water')).toBeInTheDocument();
    expect(screen.getByText('🌲 Forest')).toBeInTheDocument();

    fireEvent.click(screen.getByText('🌲 Forest'));
    expect(useMapStore.getState().editorTerrain).toBe('FOREST');
  });

  it('renders selected tile box when a tile is selected', () => {
    useMapStore.setState({
      selectedTile: { q: 2, r: 3 },
      currentMap: makeMap({
        map: {
          tiles: [
            { coordinate: { q: 2, r: 3 }, elevation: 4, terrain: 'ROCKS', ownerId: null },
          ],
        },
      }),
    });
    render(<EditorPanel />);
    expect(screen.getByText('Selected Tile')).toBeInTheDocument();
    expect(screen.getByText('(2, 3)')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('🪨 Rocks')).toBeInTheDocument();
  });

  it('renders and dismisses error alert', () => {
    const onClearError = vi.fn();
    render(<EditorPanel error="Network error occurred" onClearError={onClearError} />);
    expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    const closeBtn = screen.getByRole('button', { name: /clear editor error/i });
    fireEvent.click(closeBtn);
    expect(onClearError).toHaveBeenCalledTimes(1);
  });

  it('renders regenerate terrain button and opens dimension popup to trigger regeneration', async () => {
    const updatedMap = makeMap({ name: 'Regenerated Terrain Map' });
    vi.mocked(mapApi.regenerateMapTerrain).mockResolvedValue(updatedMap);

    render(<EditorPanel />);
    const btn = screen.getByRole('button', { name: /regenerate terrain/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);

    // Popup opens
    expect(screen.getByText('Regenerate Map Terrain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Small/i })).toBeInTheDocument();

    // Select Small
    fireEvent.click(screen.getByRole('button', { name: /Small/i }));

    // Click Regenerate in dialog
    const confirmBtn = screen.getByRole('button', { name: /^Regenerate$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mapApi.regenerateMapTerrain).toHaveBeenCalledWith(MAP_ID, { mapSize: 'SMALL' });
      expect(useMapStore.getState().currentMap?.name).toBe('Regenerated Terrain Map');
    });
  });

  it('allows choosing custom dimensions in regeneration popup', async () => {
    const updatedMap = makeMap({ name: 'Custom Sized Map' });
    vi.mocked(mapApi.regenerateMapTerrain).mockResolvedValue(updatedMap);

    render(<EditorPanel />);
    const btn = screen.getByRole('button', { name: /regenerate terrain/i });
    fireEvent.click(btn);

    // Click Custom Size
    fireEvent.click(screen.getByText('Custom Size'));

    const colsInput = screen.getByLabelText(/Columns/i);
    const rowsInput = screen.getByLabelText(/Rows/i);

    fireEvent.change(colsInput, { target: { value: '35' } });
    fireEvent.change(rowsInput, { target: { value: '45' } });

    const confirmBtn = screen.getByRole('button', { name: /^Regenerate$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mapApi.regenerateMapTerrain).toHaveBeenCalledWith(MAP_ID, { cols: 35, rows: 45 });
      expect(useMapStore.getState().currentMap?.name).toBe('Custom Sized Map');
    });
  });

  it('renders regenerate terrain button in floating view and handles errors in popup', async () => {
    vi.mocked(mapApi.regenerateMapTerrain).mockRejectedValue(new Error('Generation failed'));

    render(<EditorPanel floating />);
    const btn = screen.getByRole('button', { name: /regenerate terrain/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);

    expect(screen.getByText('Regenerate Map Terrain')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /^Regenerate$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getAllByText('Generation failed').length).toBeGreaterThan(0);
    });
  });
});
