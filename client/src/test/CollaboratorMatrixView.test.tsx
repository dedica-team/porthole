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
  handleEditCollaboratorMatrix: vi.fn(),
  handleEditLandmark: vi.fn(),
  handleRemoveLandmark: vi.fn(),
  actionLoading: false,
  error: '',
  setError: vi.fn(),
};

function setup(matrixCollaborators: string[] = ['c1']) {
  useAuthStore.setState({ userId: 'c1', username: 'Alice', token: 'tok', isAuthenticated: true });
  useMapStore.setState({
    currentMap: {
      id: 'map1',
      createdAt: '',
      collaborators: [COLLAB1, { id: 'c2', username: 'Bob' }],
      landmarks: { [LM1.id]: LM1 },
      connections: {},
      groups: {},
      map: { tiles: [] },
    },
    collaboratorMatrix: {
      name: 'test',
      collaborators: matrixCollaborators,
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

  it('renders landmark names and collaborator columns', () => {
    setup();
    render(<CollaboratorMatrixView />);
    expect(screen.getByText('Tower 1')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('allows opening edit matrix dialog and saving changes', () => {
    setup(['c1']);
    render(<CollaboratorMatrixView />);

    const editBtn = screen.getByRole('button', { name: /edit|users/i });
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit Collaborator Matrix')).toBeInTheDocument();
    expect(screen.getByLabelText('Bob')).toBeInTheDocument();

    // Check Bob to add him to matrix
    fireEvent.click(screen.getByLabelText('Bob'));

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveBtn);

    expect(mockActions.handleEditCollaboratorMatrix).toHaveBeenCalledWith('test', ['c1', 'c2']);
  });

  it('renders empty collaborator message when no collaborators in matrix', () => {
    setup([]);
    render(<CollaboratorMatrixView />);
    expect(screen.getByText('No collaborators added to the matrix yet.')).toBeInTheDocument();
  });

  it('clicking landmark name opens LandmarkInfoPopover and allows removal', () => {
    setup();
    render(<CollaboratorMatrixView />);

    // Open popover
    fireEvent.click(screen.getByText('Tower 1'));

    // Go to edit mode in popover
    const editBtn = screen.getByTitle('Edit Element');
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
