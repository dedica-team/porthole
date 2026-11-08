import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GameHUD from '../components/GameHUD/GameHUD';
import { useMapStore } from '../store/mapStore';
import type { GameState } from '../types/game';

vi.mock('../api/mapApi', () => ({
  leaveWatchtower: vi.fn().mockResolvedValue(undefined),
}));

const activeGame: GameState = {
  wave: 3,
  phase: 'ACTIVE',
  bugs: {
    b1: {
      id: 'b1',
      coordinate: { q: 1, r: 0 },
      spawnCoordinate: { q: 1, r: 0 },
      hp: 1,
      type: 'CRAWLER',
      targetLandmarkId: 'l1',
      spawnedAt: '2026-01-01T00:00:00Z',
    },
  },
  buildingHealth: {},
  towerOccupants: {},
  nextWaveAt: null,
};

describe('GameHUD', () => {
  beforeEach(() => {
    useMapStore.setState({
      gameState: null,
      activeWatchtowerId: null,
      selectedTile: null,
      selectedLandmark: null,
      mainView: 'idle',
      editorMode: false,
      currentMap: {
        id: 'map-1',
        createdAt: '',
        collaborators: [],
        landmarks: {},
        connections: {},
        groups: {},
        map: { tiles: [] },
        gameEnabled: true,
      },
    });
  });

  it('renders nothing while the game is disabled and no tile selected', () => {
    useMapStore.setState({
      gameState: activeGame,
      currentMap: {
        id: 'map-1',
        createdAt: '',
        collaborators: [],
        landmarks: {},
        connections: {},
        groups: {},
        map: { tiles: [] },
        gameEnabled: false,
      },
    });
    const { container } = render(<GameHUD />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the game is idle and no tile selected', () => {
    useMapStore.setState({ gameState: { ...activeGame, phase: 'IDLE', bugs: {} } });
    const { container } = render(<GameHUD />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the wave, bug count and buildings under attack', () => {
    useMapStore.setState({ gameState: activeGame });
    render(<GameHUD />);
    expect(screen.getByText(/Wave 3/)).toBeInTheDocument();
    expect(screen.getByText(/1 bug\b/)).toBeInTheDocument();
    expect(screen.getByText(/1 under attack/)).toBeInTheDocument();
  });

  it('shows the watchtower exit control and aim instruction while inside a tower', () => {
    useMapStore.setState({ gameState: activeGame, activeWatchtowerId: 'tower-1' });
    render(<GameHUD />);
    expect(screen.getByText(/Watchtower/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument();
    expect(screen.getByText(/Drag to aim/i)).toBeInTheDocument();
  });

  it('shows selected tile coordinates and landmark type when selected', () => {
    useMapStore.setState({
      selectedTile: { q: 2, r: -1 },
      selectedLandmark: { id: 'l1', name: 'My Keep', ownerId: 'u1', coordinate: { q: 2, r: -1 }, type: 'KEEP' },
      mainView: 'landmark',
    });
    render(<GameHUD />);
    expect(screen.getByText(/\(2, -1\)/)).toBeInTheDocument();
    expect(screen.getByText(/KEEP/)).toBeInTheDocument();
  });

  it('shows wave, aim instruction, and tile coordinates combined in one box', () => {
    useMapStore.setState({
      gameState: activeGame,
      activeWatchtowerId: 'tower-1',
      selectedTile: { q: 3, r: 1 },
      selectedLandmark: { id: 'l2', name: 'Main Tower', ownerId: 'u1', coordinate: { q: 3, r: 1 }, type: 'WATCHTOWER' },
      mainView: 'landmark',
    });
    render(<GameHUD />);
    expect(screen.getByText(/Wave 3/)).toBeInTheDocument();
    expect(screen.getByText(/Drag to aim/i)).toBeInTheDocument();
    expect(screen.getByText(/\(3, 1\)/)).toBeInTheDocument();
    expect(screen.getByText(/WATCHTOWER/)).toBeInTheDocument();
  });

  it('does not show selection coordinates when in editorMode', () => {
    useMapStore.setState({
      selectedTile: { q: 2, r: -1 },
      mainView: 'tile',
      editorMode: true,
    });
    const { container } = render(<GameHUD />);
    expect(container).toBeEmptyDOMElement();
  });
});
