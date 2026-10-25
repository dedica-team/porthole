import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreateEditGreenkeepingRotationDialog from '../components/GreenkeepingRotationsView/CreateEditGreenkeepingRotationDialog';
import * as mapApi from '../api/mapApi';
import { useAuthStore, useMapStore } from '../store/mapStore';
import type { SessionState } from '../types/session';
import type { GreenkeepingRotation } from '../types/greenkeeping';

vi.mock('../api/mapApi');

const MAP_ID = 'map-test-template';

const makeMap = (): SessionState => ({
  id: MAP_ID,
  createdAt: new Date().toISOString(),
  collaborators: [
    { id: 'u1', username: 'alice' },
    { id: 'u2', username: 'bob' },
  ],
  landmarks: {},
  connections: {},
  groups: {
    g1: { id: 'g1', name: 'Core', color: '#00ffcc' },
  },
  map: { tiles: [] },
});

const sampleRotation: GreenkeepingRotation = {
  id: 'rot-1',
  name: 'Hygiene Steward',
  description: 'Weekly cleaning',
  link: 'https://example.com/hygiene',
  groupIds: ['g1'],
  collaborators: [
    { id: 'entry-1', collaboratorId: 'u1', done: false },
  ],
  taskTemplates: [
    { id: 'tpl-1', title: 'Check sterilizer' },
  ],
};

describe('CreateEditGreenkeepingRotationDialog - Template Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'tok',
      userId: 'u1',
      username: 'alice',
      avatarUrl: null,
      isAdmin: false,
      isAuthenticated: true,
      sessionLoading: false,
    });
    useMapStore.setState({
      currentMap: makeMap(),
    });
  });

  it('pre-fills existing template tasks in edit mode', () => {
    render(
      <CreateEditGreenkeepingRotationDialog
        open={true}
        onOpenChange={vi.fn()}
        rotation={sampleRotation}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('Check sterilizer')).toBeInTheDocument();
  });

  it('allows adding and removing template tasks', async () => {
    render(
      <CreateEditGreenkeepingRotationDialog
        open={true}
        onOpenChange={vi.fn()}
        rotation={sampleRotation}
        onSaved={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add task/i }));

    const inputs = screen.getAllByPlaceholderText(/Task title…/i);
    expect(inputs.length).toBe(2);

    fireEvent.change(inputs[1], { target: { value: 'Inspect drains' } });
    expect(screen.getByDisplayValue('Inspect drains')).toBeInTheDocument();

    const removeButtons = screen.getAllByTitle(/Remove task/i);
    fireEvent.click(removeButtons[0]);

    expect(screen.queryByDisplayValue('Check sterilizer')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Inspect drains')).toBeInTheDocument();
  });

  it('saves template tasks on submit', async () => {
    const onSaved = vi.fn();
    vi.mocked(mapApi.editGreenkeepingRotation).mockResolvedValue([
      {
        ...sampleRotation,
        taskTemplates: [{ id: 'tpl-1', title: 'Check sterilizer updated' }],
      },
    ]);

    render(
      <CreateEditGreenkeepingRotationDialog
        open={true}
        onOpenChange={vi.fn()}
        rotation={sampleRotation}
        onSaved={onSaved}
      />
    );

    const titleInput = screen.getByDisplayValue('Check sterilizer');
    fireEvent.change(titleInput, { target: { value: 'Check sterilizer updated' } });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mapApi.editGreenkeepingRotation).toHaveBeenCalledWith(
        MAP_ID,
        'rot-1',
        expect.objectContaining({
          taskTemplates: [
            { id: 'tpl-1', title: 'Check sterilizer updated' },
          ],
        }),
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });
});
