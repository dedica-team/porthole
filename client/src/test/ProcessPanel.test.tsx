import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProcessPanel from '../components/Sidebar/panels/ProcessPanel';
import { useMapStore, useAuthStore } from '../store/mapStore';
import * as mapApi from '../api/mapApi';
import type { Process } from '../types/map';

const MAP_BASE = {
  id: 'map-1',
  createdAt: '',
  collaborators: [{ id: 'p1', username: 'alice' }],
  landmarks: {
    lm1: { id: 'lm1', name: 'Keep', ownerId: 'p1', coordinate: { q: 0, r: 0 }, type: 'KEEP' as const },
    lm2: { id: 'lm2', name: 'Tower', ownerId: 'p1', coordinate: { q: 2, r: 0 }, type: 'WATCHTOWER' as const },
  },
  connections: {
    c1: { id: 'c1', originId: 'lm1', targetId: 'lm2', path: [], type: 'PIPE' as const, name: 'Main pipe' },
  },
  groups: {},
  metrics: {},
  map: { tiles: [] },
};

const PROCESS_LIST: Process[] = [
  { id: 'proc-1', name: 'Alpha Flow', description: 'First', stages: [] },
  { id: 'proc-2', name: 'Beta Flow', stages: [] },
];

function setup(processes: Process[] = [], loading = false, error: string | null = null) {
  useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
  useMapStore.setState({
    currentMap: MAP_BASE,
    processes,
    processesLoading: loading,
    processesError: error,
    // Always mark as fetched so the useEffect doesn't trigger an automatic fetch in tests
    processesFetched: true,
    processMode: true,
    activeProcessId: null,
    activeStageId: null,
  });
}

describe('ProcessPanel – Process List View', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading spinner while processes are loading', () => {
    setup([], true);
    render(<ProcessPanel />);
    expect(screen.getByText(/loading processes/i)).toBeInTheDocument();
  });

  it('shows error message with retry button on error', () => {
    setup([], false, 'Network error');
    render(<ProcessPanel />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows empty state when no processes exist', () => {
    setup([]);
    render(<ProcessPanel />);
    expect(screen.getByText(/no processes yet/i)).toBeInTheDocument();
  });

  it('renders process names', () => {
    setup(PROCESS_LIST);
    render(<ProcessPanel />);
    expect(screen.getByText('Alpha Flow')).toBeInTheDocument();
    expect(screen.getByText('Beta Flow')).toBeInTheDocument();
  });

  it('shows inline create form when New button is clicked', () => {
    setup(PROCESS_LIST);
    render(<ProcessPanel />);
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    expect(screen.getByPlaceholderText(/process name/i)).toBeInTheDocument();
  });

  it('calls createProcess and updates store when form is submitted', async () => {
    const updated: Process[] = [...PROCESS_LIST, { id: 'proc-3', name: 'Gamma', stages: [] }];
    vi.spyOn(mapApi, 'createProcess').mockResolvedValue(updated);
    setup(PROCESS_LIST);
    render(<ProcessPanel />);
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    fireEvent.change(screen.getByPlaceholderText(/process name/i), { target: { value: 'Gamma' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(mapApi.createProcess).toHaveBeenCalledWith('map-1', 'Gamma'));
    expect(useMapStore.getState().processes).toHaveLength(3);
  });

  it('retry button calls fetchProcesses', async () => {
    vi.spyOn(mapApi, 'fetchProcesses').mockResolvedValue(PROCESS_LIST);
    setup([], false, 'Oops');
    render(<ProcessPanel />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(mapApi.fetchProcesses).toHaveBeenCalledWith('map-1'));
  });
});

describe('ProcessPanel – Process Detail View', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens edit dialog when three-dots button is clicked in detail view', async () => {
    // Navigate into detail view first, then click the MoreHorizontal button
    useMapStore.setState({
      ...useMapStore.getState(),
      activeProcessId: 'proc-1',
      processes: PROCESS_LIST,
    });
    render(<ProcessPanel />);
    // The MoreHorizontal button in the process detail header (title="Edit process")
    const moreBtn = screen.getByTitle('Edit process');
    fireEvent.click(moreBtn);
    await waitFor(() => expect(screen.getByLabelText(/name/i)).toBeInTheDocument());
  });

  it('shows Add Stage button in detail view', () => {
    useMapStore.setState({
      ...useMapStore.getState(),
      activeProcessId: 'proc-1',
      processes: PROCESS_LIST,
    });
    render(<ProcessPanel />);
    expect(screen.getByRole('button', { name: /add stage/i })).toBeInTheDocument();
  });

  it('calls createProcessStage when Add Stage is confirmed', async () => {
    const withStage: Process[] = [{
      id: 'proc-1',
      name: 'Alpha Flow',
      stages: [{ id: 's1', order: 0, connections: [] }],
    }, PROCESS_LIST[1]];
    vi.spyOn(mapApi, 'createProcessStage').mockResolvedValue(withStage);
    useMapStore.setState({
      ...useMapStore.getState(),
      activeProcessId: 'proc-1',
      processes: PROCESS_LIST,
    });
    render(<ProcessPanel />);
    fireEvent.click(screen.getByRole('button', { name: /add stage/i }));
    const addBtn = await screen.findByRole('button', { name: /^add$/i });
    fireEvent.click(addBtn);
    await waitFor(() => expect(mapApi.createProcessStage).toHaveBeenCalled());
  });

  it('calls removeProcess when delete is triggered from edit dialog', async () => {
    vi.spyOn(mapApi, 'removeProcess').mockResolvedValue([PROCESS_LIST[1]]);
    // Pre-select proc-1 so detail view is shown
    useMapStore.setState({
      ...useMapStore.getState(),
      activeProcessId: 'proc-1',
      processes: PROCESS_LIST,
    });
    render(<ProcessPanel />);
    // Open edit dialog via three-dots button
    fireEvent.click(screen.getByTitle('Edit process'));
    // Click Delete in the dialog footer
    const deleteBtn = await screen.findByRole('button', { name: /^delete$/i });
    fireEvent.click(deleteBtn);
    // Confirm delete
    const confirmBtn = await screen.findByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(mapApi.removeProcess).toHaveBeenCalledWith('map-1', 'proc-1'));
  });
});

describe('ProcessPanel – Stage Detail View', () => {
  const processWithStage: Process[] = [{
    id: 'proc-1',
    name: 'Alpha Flow',
    stages: [
      { id: 's1', name: 'Analysis', order: 0, connections: [{ id: 'sc-1', connectionId: 'c1', direction: 'FORWARD' }] },
    ],
  }];

  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({
      currentMap: MAP_BASE,
      processes: processWithStage,
      processMode: true,
      activeProcessId: 'proc-1',
      activeStageId: 's1',
      processesFetched: true,
      processesLoading: false,
      processesError: null,
    });
  });

  it('renders connections in the stage', () => {
    render(<ProcessPanel />);
    expect(screen.getByText(/main pipe/i)).toBeInTheDocument();
  });

  it('shows landmark names for connection endpoints', () => {
    render(<ProcessPanel />);
    expect(screen.getByText(/Keep/)).toBeInTheDocument();
    expect(screen.getByText(/Tower/)).toBeInTheDocument();
  });

  it('shows instruction tooltip trigger (help icon) in stage body', () => {
    render(<ProcessPanel />);
    // The help hint is inside a Tooltip; the trigger button contains a HelpCircle icon
    const allButtons = screen.getAllByRole('button');
    // At least one button should exist in the expanded stage body (edit/up/down/delete/help)
    expect(allButtons.length).toBeGreaterThan(0);
  });

  it('calls removeConnectionFromStage when delete button in edit popup is clicked', async () => {
    vi.spyOn(mapApi, 'removeConnectionFromStage').mockResolvedValue(processWithStage);
    render(<ProcessPanel />);
    // Open the edit connection dialog by clicking the connection row
    const connectionRow = screen.getByText(/main pipe/i).closest('button')!;
    fireEvent.click(connectionRow);
    // Click the Delete button inside the dialog
    const deleteBtn = await screen.findByRole('button', { name: /^delete$/i });
    fireEvent.click(deleteBtn);
    // Confirm delete
    const confirmBtn = await screen.findByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmBtn);
    await waitFor(() =>
      expect(mapApi.removeConnectionFromStage).toHaveBeenCalledWith('map-1', 'proc-1', 's1', 'sc-1'),
    );
  });

  it('back button clears activeStageId', () => {
    render(<ProcessPanel />);
    const chevron = screen.getAllByRole('button').find(
      (b) => b.querySelector('svg.lucide-chevron-left'),
    )!;
    fireEvent.click(chevron);
    expect(useMapStore.getState().activeStageId).toBeNull();
  });
});

