import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MapSettingsForm } from '../components/Navbar/MapSettingsForm';
import { useMapStore, useAuthStore } from '../store/mapStore';
import * as mapApi from '../api/mapApi';
import type { SessionState } from '../types/session';

vi.mock('../api/mapApi', () => ({
  editMap: vi.fn(),
  setCollaborationMode: vi.fn(),
  exportMapJson: vi.fn(),
  removeCollaborator: vi.fn(),
}));

const MAP_ID = 'test-map-settings-123';

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

describe('MapSettingsForm', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({
      currentMap: makeMap(),
    });
    useAuthStore.setState({
      userId: 'p1',
      username: 'alice',
      isAdmin: false,
    });
  });

  it('renders map settings form fields and export button', () => {
    render(<MapSettingsForm onClose={onClose} />);
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export session JSON/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /regenerate terrain/i })).not.toBeInTheDocument();
  });

  it('shows wave intermission period input when game is enabled', () => {
    useMapStore.setState({
      currentMap: makeMap({ gameEnabled: true, waveIntermissionPeriod: 'PT1H' }),
    });
    render(<MapSettingsForm onClose={onClose} />);
    expect(screen.getByLabelText(/Wave intermission period/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('PT1H')).toBeInTheDocument();
  });

  it('saves wave intermission period on save', async () => {
    const updatedMap = makeMap({ gameEnabled: true, waveIntermissionPeriod: 'PT20S' });
    vi.mocked(mapApi.editMap).mockResolvedValue(updatedMap);

    useMapStore.setState({
      currentMap: makeMap({ gameEnabled: true, waveIntermissionPeriod: 'PT1H' }),
    });
    render(<MapSettingsForm onClose={onClose} />);

    const input = screen.getByLabelText(/Wave intermission period/i);
    fireEvent.change(input, { target: { value: 'PT20S' } });

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mapApi.editMap).toHaveBeenCalledWith(
        MAP_ID,
        undefined,
        undefined,
        true,
        'PT20S',
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
