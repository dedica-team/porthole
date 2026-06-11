import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CollaboratorMatrixView from '../components/CollaboratorMatrixView/CollaboratorMatrixView';
import * as MapActionsContext from '../pages/MapPage/MapActionsContext';
import { useMapStore, useAuthStore } from '../store/mapStore';
import type { Landmark } from '../types/landmark';

const LM1: Landmark = {
  id: 'lm1',
  name: 'Tower 1',
  type: 'KEEP',
  coordinate: { q: 0, r: 0 },
  ownerId: null
};

const COLLAB1 = { id: 'c1', username: 'Alice' };

const mockActions = {
  handleSetMatrixEntry: vi.fn(),
  handleEditLandmark: vi.fn(),
  handleRemoveLandmark: vi.fn(),
  actionLoading: false,
  error: '',
  setError: vi.fn(),
};

function setup() {
  useAuthStore.setState({ userId: 'c1', username: 'Alice', token: 'tok', isAuthenticated: true });
  useMapStore.setState({
    currentMap: {
      id: 'map1',
      createdAt: '',
      collaborators: [COLLAB1],
      landmarks: { [LM1.id]: LM1 },
      connections: {},
      groups: {},
      map: { tiles: [] },
    },
    collaboratorMatrix: {
      name: 'test',
      entries: {},
    },
  });
}

describe('CollaboratorMatrixView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockActions).forEach((k) => {
      const v = (mockActions as Record<string, unknown>)[k];
      if (typeof v === 'function') (mockActions as Record<string, unknown>)[k] = vi.fn();
    });
    mockActions.actionLoading = false;
    mockActions.error = '';
    vi.spyOn(MapActionsContext, 'useMapActions').mockReturnValue(
      mockActions as unknown as ReturnType<typeof MapActionsContext.useMapActions>
    );
  });

  it('renders landmark names', () => {
    setup();
    render(<CollaboratorMatrixView />);
    expect(screen.getByText('Tower 1')).toBeInTheDocument();
  });

  it('clicking landmark name opens LandmarkInfoPopover and allows removal', () => {
    setup();
    render(<CollaboratorMatrixView />);

    // Open popover
    fireEvent.click(screen.getByText('Tower 1'));

    // Go to edit mode in popover
    const editBtn = screen.getByTitle('Edit Landmark');
    fireEvent.click(editBtn);

    // Click remove button
    const removeBtn = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeBtn);

    // Confirm removal
    const confirmBtn = screen.getByRole('button', { name: /yes, remove/i });
    fireEvent.click(confirmBtn);

    expect(mockActions.handleRemoveLandmark).toHaveBeenCalledWith('lm1');
  });
});
