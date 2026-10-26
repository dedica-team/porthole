import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapSettingsForm } from '../components/Navbar/MapSettingsForm';
import { useMapStore, useAuthStore } from '../store/mapStore';
import type { SessionState } from '../types/session';

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
});
