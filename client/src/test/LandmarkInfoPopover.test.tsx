import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LandmarkInfoPopover from '../components/LandmarkInfoPopover/LandmarkInfoPopover';
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
  });
}

describe('LandmarkInfoPopover', () => {
  const defaultProps = {
    landmark: LM1,
    onEditLandmark: vi.fn(),
    onRemoveLandmark: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children as trigger', () => {
    setup();
    render(
      <LandmarkInfoPopover {...defaultProps}>
        <button>Open Me</button>
      </LandmarkInfoPopover>
    );
    expect(screen.getByText('Open Me')).toBeInTheDocument();
  });

  it('opens popover when trigger is clicked', () => {
    setup();
    render(
      <LandmarkInfoPopover {...defaultProps}>
        <button>Open Me</button>
      </LandmarkInfoPopover>
    );
    fireEvent.click(screen.getByText('Open Me'));
    expect(screen.getByText('Tower 1')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('shows edit dialog when Edit button is clicked', () => {
    setup();
    render(
      <LandmarkInfoPopover {...defaultProps}>
        <button>Open Me</button>
      </LandmarkInfoPopover>
    );
    fireEvent.click(screen.getByText('Open Me'));
    fireEvent.click(screen.getByTitle('Edit Landmark'));
    // The edit dialog should now be open with the form
    expect(screen.getByText('Edit Landmark')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toHaveValue('Tower 1');
  });

  it('shows confirmation dialog and calls onRemoveLandmark when removal is confirmed', () => {
    setup();
    const onRemove = vi.fn();
    render(
      <LandmarkInfoPopover {...defaultProps} onRemoveLandmark={onRemove}>
        <button>Open Me</button>
      </LandmarkInfoPopover>
    );
    fireEvent.click(screen.getByText('Open Me'));
    fireEvent.click(screen.getByTitle('Edit Landmark'));
    
    // Click "Remove" button in the edit dialog (destructive variant)
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    
    // Check confirmation dialog
    expect(screen.getByText(/remove «Tower 1»\?/i)).toBeInTheDocument();
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    
    // Confirm
    fireEvent.click(screen.getByRole('button', { name: /yes, remove/i }));
    
    expect(onRemove).toHaveBeenCalledWith('lm1');
  });

  it('cancels removal confirmation and returns to edit dialog', () => {
    setup();
    render(
      <LandmarkInfoPopover {...defaultProps}>
        <button>Open Me</button>
      </LandmarkInfoPopover>
    );
    fireEvent.click(screen.getByText('Open Me'));
    fireEvent.click(screen.getByTitle('Edit Landmark'));
    
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    expect(screen.getByText(/remove «Tower 1»\?/i)).toBeInTheDocument();
    
    // Click "Cancel" in confirmation dialog
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    
    // The confirmation dialog should be closed
    expect(screen.queryByText(/remove «Tower 1»\?/i)).not.toBeInTheDocument();
  });
});