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

  it('renders nothing while the game is disabled', () => {
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

  it('renders nothing while the game is idle', () => {
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

  it('shows the watchtower exit control while inside a tower', () => {
    useMapStore.setState({ gameState: activeGame, activeWatchtowerId: 'tower-1' });
    render(<GameHUD />);
    expect(screen.getByText(/Watchtower/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument();
  });
});
