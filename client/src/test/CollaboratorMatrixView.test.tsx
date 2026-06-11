import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CollaboratorMatrixView from '../components/CollaboratorMatrixView/CollaboratorMatrixView';
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
      name: "test",
      entries: {},
    },
  });
}

describe('CollaboratorMatrixView', () => {
  const defaultProps = {
    onEditMatrix: vi.fn(),
    onSetEntry: vi.fn(),
    onClearEntry: vi.fn(),
    onEditLandmark: vi.fn(),
    onRemoveLandmark: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders landmark names', () => {
    setup();
    render(<CollaboratorMatrixView {...defaultProps} />);
    expect(screen.getByText('Tower 1')).toBeInTheDocument();
  });

  it('clicking landmark name opens LandmarkInfoPopover and allows removal', () => {
    setup();
    const onRemoveLandmark = vi.fn();
    render(<CollaboratorMatrixView {...defaultProps} onRemoveLandmark={onRemoveLandmark} />);

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

    expect(onRemoveLandmark).toHaveBeenCalledWith('lm1');
  });
});
