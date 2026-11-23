import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProcessDesignView from '@/pages/ProcessDesign/ProcessDesignView';
import { useMapStore } from '@/store/mapStore';
import * as api from '@/api/mapApi';
import type { Process } from '@/types/process';
import type { SessionState } from '@/types/session';

vi.mock('@/api/mapApi', () => ({
  fetchProcesses: vi.fn(),
  createProcess: vi.fn(),
  editProcess: vi.fn(),
  saveProcess: vi.fn(),
  removeProcess: vi.fn(),
  createProcessStage: vi.fn(),
  editProcessStage: vi.fn(),
  removeProcessStage: vi.fn(),
  reorderProcessStages: vi.fn(),
  addConnectionToStage: vi.fn(),
  editStageConnection: vi.fn(),
  removeConnectionFromStage: vi.fn(),
  createConnection: vi.fn(),
  editConnection: vi.fn(),
  removeConnection: vi.fn(),
}));

const process: Process = {
  id: 'p1',
  name: 'Original',
  description: 'Desc',
  stages: [
    { id: 's1', name: 'First', order: 0, connections: [{ id: 'sc1', connectionId: 'c1', direction: 'FORWARD', title: 'Main' }] },
    { id: 's2', name: 'Second', order: 1, connections: [] },
  ],
};

const map = {
  id: 'map',
  map: { tiles: [] },
  landmarks: { a: { id: 'a', name: 'Alpha' }, b: { id: 'b', name: 'Beta' } },
  connections: { c1: { id: 'c1', originId: 'a', targetId: 'b', name: 'Link', type: 'PIPE' } },
  collaborators: [],
} as unknown as SessionState;

function show(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/session/:id/process-design" element={<ProcessDesignView />} />
        <Route path="/session/:id/process-design/:processId" element={<ProcessDesignView />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.fetchProcesses).mockResolvedValue([]);
  useMapStore.setState({ currentMap: map, processes: [], processesFetched: true });
});

describe('ProcessDesignView', () => {
  it('creates a process by comparing ids and opens its editor', async () => {
    useMapStore.setState({ processes: [process] });
    vi.mocked(api.createProcess).mockResolvedValue([
      { ...process, name: 'Changed elsewhere' },
      { id: 'p2', name: 'New', stages: [] },
    ]);
    show('/session/map/process-design');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create process' }));
    await screen.findByRole('heading', { name: 'New' });
    expect(api.createProcess).toHaveBeenCalledWith('map', 'New', undefined);
  });

  it('updates details in modal and saves full process via Save changes button', async () => {
    useMapStore.setState({ processes: [process] });
    vi.mocked(api.saveProcess).mockResolvedValue([
      { ...process, name: 'Updated Name', description: 'New description' },
    ]);
    show('/session/map/process-design/p1');
    expect(screen.getByRole('heading', { name: 'Original' })).toBeInTheDocument();

    // Open Edit process details modal
    fireEvent.click(screen.getByRole('button', { name: 'Edit process details' }));
    expect(screen.getByRole('heading', { name: 'Edit process details' })).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Name');
    const descInput = screen.getByLabelText('Description');
    expect(nameInput).toHaveValue('Original');
    expect(descInput).toHaveValue('Desc');

    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    fireEvent.change(descInput, { target: { value: 'New description' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply details' }));

    // Verify draft name updated in overview header
    expect(screen.getByRole('heading', { name: 'Updated Name' })).toBeInTheDocument();

    // Click Save changes button
    const saveBtn = screen.getByRole('button', { name: 'Save changes' });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.saveProcess).toHaveBeenCalledWith(
        'map',
        'p1',
        expect.objectContaining({
          name: 'Updated Name',
          description: 'New description',
        })
      );
    });
  });

  it('toggles connection direction and edits connection title in memory draft', async () => {
    useMapStore.setState({ processes: [process] });
    vi.mocked(api.saveProcess).mockResolvedValue([process]);
    show('/session/map/process-design/p1');

    // Click direction toggle badge (Forward -> Reverse)
    const toggleBtn = screen.getByRole('button', { name: /Toggle direction for Alpha → Beta/i });
    expect(toggleBtn).toHaveTextContent('Forward');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('Reverse');

    // Edit connection title
    const titleInput = screen.getByLabelText('Title for connection Alpha → Beta (Link)');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

    // Save changes
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(api.saveProcess).toHaveBeenCalledWith(
        'map',
        'p1',
        expect.objectContaining({
          stages: expect.arrayContaining([
            expect.objectContaining({
              connections: expect.arrayContaining([
                expect.objectContaining({
                  direction: 'REVERSE',
                  title: 'Updated Title',
                }),
              ]),
            }),
          ]),
        })
      );
    });
  });

  it('supports batch adding connections to a stage', async () => {
    useMapStore.setState({ processes: [process] });
    vi.mocked(api.saveProcess).mockResolvedValue([process]);
    show('/session/map/process-design/p1');

    const secondSection = screen.getByDisplayValue('Second').closest('section')!;
    const batchBtn = within(secondSection).getByRole('button', { name: 'Batch add' });
    fireEvent.click(batchBtn);

    expect(screen.getByRole('heading', { name: 'Add connections to Second' })).toBeInTheDocument();

    // Check connection c1
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Click Add selected
    fireEvent.click(screen.getByRole('button', { name: /Add selected \(1\)/i }));

    // Connection row should now appear in the Second stage section
    expect(
      within(secondSection).getByRole('button', { name: /Toggle direction for Alpha → Beta/i })
    ).toBeInTheDocument();
  });

  it('preserves a dirty draft on a remote update and lets the user discard it', () => {
    useMapStore.setState({ processes: [process] });
    show('/session/map/process-design/p1');

    // Edit stage name to make draft dirty
    const firstStageInput = screen.getByLabelText('Stage 1 name');
    fireEvent.change(firstStageInput, { target: { value: 'My Draft Stage' } });

    // Remote store update occurs
    act(() => useMapStore.getState().setProcesses([{ ...process, name: 'Remote Process' }]));

    // Draft is preserved and conflict alert is visible
    expect(screen.getByLabelText('Stage 1 name')).toHaveValue('My Draft Stage');
    expect(screen.getByRole('alert')).toHaveTextContent('updated remotely');

    // Discard draft
    fireEvent.click(screen.getByText('Discard draft and load latest'));
    expect(screen.getByLabelText('Stage 1 name')).toHaveValue('First');
  });

  it('adds an element from the elements list to the canvas', () => {
    const extraMap = {
      ...map,
      landmarks: {
        ...map.landmarks,
        c: { id: 'c', name: 'Gamma', type: 'TOWER' },
      },
    } as unknown as SessionState;
    useMapStore.setState({ currentMap: extraMap, processes: [process] });
    show('/session/map/process-design/p1');

    expect(screen.getByText('Map Elements')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();

    // Click Add button for Gamma in Map Elements panel
    const addGammaBtn = screen.getByRole('button', { name: 'Add Gamma to canvas' });
    fireEvent.click(addGammaBtn);

    // Gamma node should now appear on the canvas
    expect(screen.getByRole('button', { name: 'Landmark: Gamma' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Added "Gamma" to canvas');
  });

  it('opens modal and creates connection on the fly when connecting nodes without map connection', async () => {
    const extraMap = {
      ...map,
      landmarks: {
        ...map.landmarks,
        c: { id: 'c', name: 'Gamma', type: 'TOWER', coordinate: { q: 2, r: 0 } },
      },
      connections: {
        ...map.connections,
      },
    } as unknown as SessionState;

    const updatedMapWithNewConn = {
      ...extraMap,
      connections: {
        ...extraMap.connections,
        c2: { id: 'c2', originId: 'a', targetId: 'c', name: 'Alpha to Gamma', type: 'PIPE' },
      },
    } as unknown as SessionState;

    vi.mocked(api.fetchProcesses).mockResolvedValue([process]);
    vi.mocked(api.createConnection).mockResolvedValue(updatedMapWithNewConn);

    useMapStore.setState({ currentMap: extraMap, processes: [process], processesFetched: true });
    show('/session/map/process-design/p1');

    // Add Gamma to canvas
    const addGammaBtn = screen.getByRole('button', { name: 'Add Gamma to canvas' });
    fireEvent.click(addGammaBtn);

    // Alpha and Gamma are on canvas. Drag connect from Alpha to Gamma
    const connectAlpha = screen.getByRole('button', { name: 'Connect from Alpha' });
    fireEvent.pointerDown(connectAlpha, { button: 0, clientX: 340, clientY: 130, pointerId: 1 });
    // Gamma is placed at (x: 340, y: 390). Moving pointer over Gamma triggers hovered target node.
    fireEvent.pointerMove(connectAlpha, { clientX: 340, clientY: 390, pointerId: 1 });
    fireEvent.pointerUp(connectAlpha, { pointerId: 1 });

    // The "New Connection" modal opens with Alpha and Gamma preselected
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'New Connection' })).toBeInTheDocument();
    expect(within(dialog).getByText('Alpha')).toBeInTheDocument();
    expect(within(dialog).getByText('Gamma')).toBeInTheDocument();

    // Stage dropdown is present and preselected to First stage
    const stageSelect = within(dialog).getByLabelText('Stage') as HTMLSelectElement;
    expect(stageSelect).toBeInTheDocument();
    expect(stageSelect.value).toBe('s1');

    // Click Create Connection in dialog
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Connection' }));

    await waitFor(() => {
      expect(api.createConnection).toHaveBeenCalledWith('map', 'a', 'c', 'PIPE', undefined);
    });

    // Connection is created on the fly and linked into the first stage
    expect(await screen.findByRole('alert')).toHaveTextContent('Created connection and linked "Alpha" → "Gamma" in First');
  });

  it('allows selecting target stage or creating new stage in on-the-fly connection modal', async () => {
    const extraMap = {
      ...map,
      landmarks: {
        ...map.landmarks,
        c: { id: 'c', name: 'Gamma', type: 'TOWER', coordinate: { q: 2, r: 0 } },
      },
      connections: {
        ...map.connections,
      },
    } as unknown as SessionState;

    const updatedMapWithNewConn = {
      ...extraMap,
      connections: {
        ...extraMap.connections,
        c2: { id: 'c2', originId: 'a', targetId: 'c', name: 'Alpha to Gamma', type: 'PIPE' },
      },
    } as unknown as SessionState;

    vi.mocked(api.fetchProcesses).mockResolvedValue([process]);
    vi.mocked(api.createConnection).mockResolvedValue(updatedMapWithNewConn);

    useMapStore.setState({ currentMap: extraMap, processes: [process], processesFetched: true });
    show('/session/map/process-design/p1');

    // Use Quick Add "+ Create connection on the fly…" in Second stage (Stage 2)
    const stage2Select = screen.getAllByLabelText('Existing connection')[1];
    fireEvent.change(stage2Select, { target: { value: '__CREATE_ON_THE_FLY__' } });

    // The modal opens
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'New Connection' })).toBeInTheDocument();

    // Stage dropdown should default to s2 (Second stage)
    const stageSelect = within(dialog).getByLabelText('Stage') as HTMLSelectElement;
    expect(stageSelect.value).toBe('s2');

    // Change stage dropdown to "+ New stage"
    fireEvent.change(stageSelect, { target: { value: '__NEW_STAGE__' } });

    // Pick Alpha as start and Gamma as end
    const triggers = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button[role="combobox"]'));
    act(() => { fireEvent.click(triggers[0]); });
    fireEvent.click(await screen.findByRole('button', { name: 'Alpha' }));

    act(() => { fireEvent.click(triggers[1]); });
    fireEvent.click(await screen.findByRole('button', { name: 'Gamma' }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Connection' }));

    await waitFor(() => {
      expect(api.createConnection).toHaveBeenCalledWith('map', 'a', 'c', 'PIPE', undefined);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Created connection and linked "Alpha" → "Gamma" in Stage 3');
  });

  it('removes connection from stage via three-dot options menu', async () => {
    useMapStore.setState({ processes: [process] });
    show('/session/map/process-design/p1');

    // Find the three-dot button for connection
    const optionsBtn = screen.getByRole('button', { name: /Options for connection Alpha → Beta/i });
    fireEvent.click(optionsBtn);

    // Click "Remove from stage"
    const removeBtn = screen.getByRole('button', { name: 'Remove from stage' });
    fireEvent.click(removeBtn);

    // Connection should no longer be displayed in First stage
    expect(screen.queryByLabelText('Title for connection Alpha → Beta (Link)')).not.toBeInTheDocument();
    const firstSection = screen.getByLabelText('Stage 1 name').closest('section')!;
    expect(within(firstSection).getByText('No connections in this stage.')).toBeInTheDocument();
  });

  it('edits connection details via three-dot options menu and calls editConnection', async () => {
    const updatedMapWithEditedConn = {
      ...map,
      connections: {
        c1: { id: 'c1', originId: 'a', targetId: 'b', name: 'Renamed Pipe', type: 'ROAD' },
      },
    } as unknown as SessionState;

    vi.mocked(api.editConnection).mockResolvedValue(updatedMapWithEditedConn);
    useMapStore.setState({ currentMap: map, processes: [process] });
    show('/session/map/process-design/p1');

    // Click connection options
    const optionsBtn = screen.getByRole('button', { name: /Options for connection Alpha → Beta/i });
    fireEvent.click(optionsBtn);

    // Click "Edit connection"
    const editConnBtn = screen.getByRole('button', { name: 'Edit connection' });
    fireEvent.click(editConnBtn);

    // Modal opens
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edit Connection' })).toBeInTheDocument();
    expect(within(dialog).getByText('Alpha → Beta')).toBeInTheDocument();

    // Change name and type
    const nameInput = within(dialog).getByPlaceholderText('Connection name (optional)');
    fireEvent.change(nameInput, { target: { value: 'Renamed Pipe' } });

    // Submit form
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.editConnection).toHaveBeenCalledWith(
        'map',
        'c1',
        'PIPE',
        'Renamed Pipe',
        undefined,
        false,
        true
      );
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Connection updated.');
  });

  it('deletes map connection via three-dot options menu with confirmation and removes from stages', async () => {
    const mapAfterConnDeletion = {
      ...map,
      connections: {},
    } as unknown as SessionState;

    vi.mocked(api.removeConnection).mockResolvedValue(mapAfterConnDeletion);
    useMapStore.setState({ currentMap: map, processes: [process] });
    show('/session/map/process-design/p1');

    // Click connection options
    const optionsBtn = screen.getByRole('button', { name: /Options for connection Alpha → Beta/i });
    fireEvent.click(optionsBtn);

    // Click "Delete connection"
    const deleteConnBtn = screen.getByRole('button', { name: 'Delete connection' });
    fireEvent.click(deleteConnBtn);

    // Confirmation dialog opens
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /Delete «Link» \(Alpha → Beta\)\?/i })).toBeInTheDocument();

    // Confirm deletion
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete connection' }));

    await waitFor(() => {
      expect(api.removeConnection).toHaveBeenCalledWith('map', 'c1');
    });

    // Connection removed from stage in draft
    expect(screen.queryByLabelText('Title for connection Alpha → Beta (Link)')).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection deleted from map and process stages.');
  });

  it('deletes process from bottom of card with confirmation', async () => {
    useMapStore.setState({ processes: [process] });
    vi.mocked(api.removeProcess).mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    show('/session/map/process-design/p1');
    const deleteBtn = screen.getByRole('button', { name: 'Delete process' });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(api.removeProcess).toHaveBeenCalledWith('map', 'p1');
    });
  });

  it('opens confirmation modal when clicking delete stage and removes stage upon confirmation', async () => {
    useMapStore.setState({ processes: [process] });
    show('/session/map/process-design/p1');

    // Initially both stages are present
    expect(screen.getByLabelText('Stage 1 name')).toHaveValue('First');
    expect(screen.getByLabelText('Stage 2 name')).toHaveValue('Second');

    // Click delete stage button for Stage 1 (has 1 connection)
    const deleteStageBtns = screen.getAllByRole('button', { name: 'Delete this stage' });
    fireEvent.click(deleteStageBtns[0]);

    // Confirmation modal opens
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /Delete «First» \(Stage 1\)\?/i })).toBeInTheDocument();
    expect(
      within(dialog).getByText(/This will remove the stage and its 1 connection assignment from the process\./i)
    ).toBeInTheDocument();

    // Clicking cancel keeps the stage
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Stage 1 name')).toHaveValue('First');

    // Click delete again and confirm
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete this stage' })[0]);
    const confirmDialog = await screen.findByRole('dialog');
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Yes, delete stage' }));

    // Stage 1 is removed, remaining stage becomes Stage 1
    expect(screen.getByLabelText('Stage 1 name')).toHaveValue('Second');
    expect(screen.queryByLabelText('Stage 2 name')).not.toBeInTheDocument();
  });

  it('shows loading errors and retries', async () => {
    useMapStore.setState({ processesFetched: false });
    vi.mocked(api.fetchProcesses).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([]);
    show('/session/map/process-design');
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No processes yet.')).toBeInTheDocument();
  });
});
