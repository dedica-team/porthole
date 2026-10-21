import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GreenkeepingTasklistDialog, { getTodayDateString } from '../components/GreenkeepingRotationsView/GreenkeepingTasklistDialog';
import * as mapApi from '../api/mapApi';
import * as exportUtils from '../components/GreenkeepingRotationsView/tasklistExportUtils';
import { useAuthStore, useMapStore } from '../store/mapStore';
import type { SessionState } from '../types/session';
import type { GreenkeepingRotation } from '../types/greenkeeping';

vi.mock('../api/mapApi');
vi.mock('../components/GreenkeepingRotationsView/tasklistExportUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof exportUtils>();
  return {
    ...actual,
    saveTasklistAsJson: vi.fn().mockResolvedValue(true),
  };
});

const MAP_ID = 'map-test-1';

const sampleMap: SessionState = {
  id: MAP_ID,
  createdAt: new Date().toISOString(),
  collaborators: [
    { id: 'u1', username: 'alice' },
    { id: 'u2', username: 'bob' },
  ],
  landmarks: {},
  connections: {},
  groups: {},
  map: { tiles: [] },
};

const sampleRotationNoChecklist: GreenkeepingRotation = {
  id: 'rot-100',
  name: 'Database Operations Rotation',
  groupIds: ['g1'],
  collaborators: [{ id: 'c1', collaboratorId: 'u1', done: false }],
  taskTemplates: [
    { id: 'tpl-1', title: 'Check connection pool stats' },
    { id: 'tpl-2', title: 'Verify read replica replication lag' },
  ],
};

const sampleRotationWithActiveChecklist: GreenkeepingRotation = {
  id: 'rot-100',
  name: 'Database Operations Rotation',
  groupIds: ['g1'],
  collaborators: [{ id: 'c1', collaboratorId: 'u1', done: false }],
  taskTemplates: [
    { id: 'tpl-1', title: 'Check connection pool stats' },
  ],
  currentChecklist: {
    id: 'chk-1',
    title: '2026-10-21',
    createdAt: '2026-10-21T10:00:00.000Z',
    createdBy: 'u1',
    items: [
      { id: 'item-1', title: 'Check connection pool stats', done: false, note: null },
      { id: 'item-2', title: 'Inspect slow queries', done: true, note: 'Found 1 slow query' },
    ],
  },
  completedChecklists: [
    {
      id: 'chk-0',
      title: '2026-10-14',
      createdAt: '2026-10-14T10:00:00.000Z',
      finishedAt: '2026-10-14T12:00:00.000Z',
      finishedBy: 'u1',
      items: [
        { id: 'item-0', title: 'Past task', done: true, note: 'All clean' },
      ],
    },
  ],
};

describe('GreenkeepingTasklistDialog', () => {
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
      currentMap: sampleMap,
      greenkeepingRotations: [sampleRotationNoChecklist],
    });
  });

  it('renders start checklist form when no checklist is active', () => {
    render(
      <GreenkeepingTasklistDialog
        open={true}
        onOpenChange={vi.fn()}
        rotation={sampleRotationNoChecklist}
      />
    );

    expect(screen.getByText('Database Operations Rotation – Checklist')).toBeInTheDocument();
    expect(screen.getByText(/No active checklist in progress/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start checklist/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue(getTodayDateString())).toBeInTheDocument();
  });

  it('starts a new checklist and updates state', async () => {
    vi.mocked(mapApi.startGreenkeepingChecklist).mockResolvedValue({
      ...sampleRotationNoChecklist,
      currentChecklist: {
        id: 'chk-new',
        title: '2026-10-21',
        createdAt: new Date().toISOString(),
        createdBy: 'u1',
        items: [
          { id: 'i-1', title: 'Check connection pool stats', done: false, note: null },
        ],
      },
    });

    render(
      <GreenkeepingTasklistDialog
        open={true}
        onOpenChange={vi.fn()}
        rotation={sampleRotationNoChecklist}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start checklist/i }));

    await waitFor(() => {
      expect(mapApi.startGreenkeepingChecklist).toHaveBeenCalledWith(
        MAP_ID,
        'rot-100',
        getTodayDateString(),
      );
      expect(screen.getByDisplayValue('Check connection pool stats')).toBeInTheDocument();
    });
  });

  it('displays active checklist, supports editing items and saving', async () => {
    useMapStore.setState({
      greenkeepingRotations: [sampleRotationWithActiveChecklist],
    });

    vi.mocked(mapApi.updateGreenkeepingChecklist).mockResolvedValue(sampleRotationWithActiveChecklist);

    render(
      <GreenkeepingTasklistDialog
        open={true}
        onOpenChange={vi.fn()}
        rotation={sampleRotationWithActiveChecklist}
      />
    );

    expect(screen.getByDisplayValue('2026-10-21')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Check connection pool stats')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Inspect slow queries')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();

    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();

    const noteInputs = screen.getAllByPlaceholderText(/Optional note/i);
    fireEvent.change(noteInputs[0], { target: { value: 'Pool at 20%' } });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mapApi.updateGreenkeepingChecklist).toHaveBeenCalledWith(
        MAP_ID,
        'rot-100',
        expect.objectContaining({
          title: '2026-10-21',
          items: expect.arrayContaining([
            expect.objectContaining({ title: 'Check connection pool stats', done: true, note: 'Pool at 20%' }),
          ]),
        }),
      );
    });
  });

  it('finishes active checklist with confirmation and transitions to history', async () => {
    useMapStore.setState({
      greenkeepingRotations: [sampleRotationWithActiveChecklist],
    });

    vi.mocked(mapApi.finishGreenkeepingChecklist).mockResolvedValue({
      ...sampleRotationWithActiveChecklist,
      currentChecklist: null,
      completedChecklists: [
        ...sampleRotationWithActiveChecklist.completedChecklists!,
        {
          id: 'chk-1',
          title: '2026-10-21',
          createdAt: '2026-10-21T10:00:00.000Z',
          finishedAt: '2026-10-21T11:00:00.000Z',
          finishedBy: 'u1',
          items: sampleRotationWithActiveChecklist.currentChecklist!.items,
        },
      ],
    });

    render(
      <GreenkeepingTasklistDialog
        open={true}
        onOpenChange={vi.fn()}
        rotation={sampleRotationWithActiveChecklist}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /finish checklist/i }));

    expect(screen.getByText(/Finish and lock checklist\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm finish/i }));

    await waitFor(() => {
      expect(mapApi.finishGreenkeepingChecklist).toHaveBeenCalledWith(MAP_ID, 'rot-100');
      expect(screen.getByText('History (2)')).toBeInTheDocument();
    });
  });

  it('renders completed checklists in read-only mode in History tab', () => {
    useMapStore.setState({
      greenkeepingRotations: [sampleRotationWithActiveChecklist],
    });

    render(
      <GreenkeepingTasklistDialog
        open={true}
        onOpenChange={vi.fn()}
        rotation={sampleRotationWithActiveChecklist}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /history/i }));

    expect(screen.getByText('2026-10-14')).toBeInTheDocument();
    expect(screen.getByText(/by alice/i)).toBeInTheDocument();
    expect(screen.getByText('Past task')).toBeInTheDocument();
    expect(screen.getByText(/Note: All clean/i)).toBeInTheDocument();

    const readOnlyCheckbox = screen.getByLabelText(/Task 1 done status/i);
    expect(readOnlyCheckbox).toBeDisabled();
    expect(readOnlyCheckbox).toBeChecked();
  });

  it('discards active checklist with confirmation', async () => {
    useMapStore.setState({
      greenkeepingRotations: [sampleRotationWithActiveChecklist],
    });

    vi.mocked(mapApi.discardGreenkeepingChecklist).mockResolvedValue({
      ...sampleRotationWithActiveChecklist,
      currentChecklist: null,
    });

    render(
      <GreenkeepingTasklistDialog
        open={true}
        onOpenChange={vi.fn()}
        rotation={sampleRotationWithActiveChecklist}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(screen.getByText(/Discard active in-progress checklist\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm discard/i }));

    await waitFor(() => {
      expect(mapApi.discardGreenkeepingChecklist).toHaveBeenCalledWith(MAP_ID, 'rot-100');
    });
  });
});
