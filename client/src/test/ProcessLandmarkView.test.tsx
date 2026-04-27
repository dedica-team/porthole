import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Sidebar from '../components/Sidebar/Sidebar';
import { useMapStore, useAuthStore } from '../store/mapStore';
import type { Process, Landmark } from '../types/map';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const LANDMARK_LM1 = { id: 'lm1', name: 'Iron Keep', ownerId: 'p1', coordinate: { q: 0, r: 0 }, type: 'KEEP' as const };
const LANDMARK_LM2 = { id: 'lm2', name: 'Watchtower', ownerId: 'p1', coordinate: { q: 2, r: 0 }, type: 'WATCHTOWER' as const };

const MAP_BASE = {
  id: 'map-1',
  createdAt: '',
  collaborators: [{ id: 'p1', username: 'alice' }],
  landmarks: { lm1: LANDMARK_LM1, lm2: LANDMARK_LM2 },
  connections: {
    c1: { id: 'c1', originId: 'lm1', targetId: 'lm2', path: [], type: 'PIPE' as const, name: 'Main pipe' },
    c2: { id: 'c2', originId: 'lm2', targetId: 'lm1', path: [], type: 'TELEGRAPH' as const },
  },
  groups: {},
  metrics: {},
  map: { tiles: [] },
};

const PROCESS_WITH_STAGES: Process[] = [
  {
    id: 'proc-1',
    name: 'Alpha Flow',
    stages: [
      { id: 'stage-1', order: 0, name: 'Intake', connections: [{ id: 'sc-1', connectionId: 'c1', direction: 'FORWARD' as const }] },
      { id: 'stage-2', order: 1, name: 'Output', connections: [{ id: 'sc-2', connectionId: 'c2', direction: 'REVERSE' as const }] },
    ],
  },
  {
    id: 'proc-2',
    name: 'Beta Flow',
    stages: [
      { id: 'stage-3', order: 0, name: undefined, connections: [{ id: 'sc-3', connectionId: 'c1', direction: 'BIDIRECTIONAL' as const }] },
    ],
  },
];

const DEFAULT_PROPS = {
  onPlaceLandmark: vi.fn(),
  onPositionLandmark: vi.fn(),
  onStartConnection: vi.fn(),
  onCancelConnection: vi.fn(),
  onRemoveLandmark: vi.fn(),
  onEditLandmark: vi.fn(),
  onEditConnection: vi.fn(),
  onRemoveConnection: vi.fn(),
  onCreateMetric: vi.fn(),
  onEditMetric: vi.fn(),
  onRemoveMetric: vi.fn(),
  onSetLandmarkMetric: vi.fn(),
  onClearLandmarkMetric: vi.fn(),
  loading: false as const,
  error: '',
  onClearError: vi.fn(),
};

function setupProcessMode(selectedLandmark: Landmark = LANDMARK_LM1, processes = PROCESS_WITH_STAGES) {
  useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
  useMapStore.setState({
    currentMap: MAP_BASE,
    processes,
    processesFetched: true,
    processesLoading: false,
    processesError: null,
    processMode: true,
    activeProcessId: null,
    activeStageId: null,
    mainView: 'process',
    selectedLandmark,
    selectedConnectionId: null,
  });
}

// ── ProcessLandmarkView: related processes ────────────────────────────────────

describe('Sidebar – ProcessLandmarkView (related processes)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the landmark name via LandmarkPanel', () => {
    setupProcessMode();
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getByText('Iron Keep')).toBeInTheDocument();
  });

  it('shows "Used in processes" section when landmark has connections in process stages', () => {
    setupProcessMode();
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getByText('Used in processes')).toBeInTheDocument();
  });

  it('lists all process stages that involve a connection touching the selected landmark', () => {
    setupProcessMode();
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getAllByText('Alpha Flow').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Beta Flow')).toBeInTheDocument();
    // Stage labels rendered as "Stage N: StageName" in one span
    expect(screen.getByText('Stage 1: Intake')).toBeInTheDocument();
    expect(screen.getByText('Stage 2: Output')).toBeInTheDocument();
  });

  it('shows stage index even when stage has no name', () => {
    setupProcessMode();
    render(<Sidebar {...DEFAULT_PROPS} />);
    // proc-2/stage-3 has no name; its stage label must still mention "Stage 1"
    // (it is the first/only stage in proc-2, regardless of other stages from proc-1)
    const stageLabels = screen.getAllByText(/^Stage \d+:/);
    expect(stageLabels.length).toBeGreaterThan(0);
    // At least one entry should not have a stage name after the colon
    const hasNameless = stageLabels.some((el) => /^Stage \d+:\s*$/.test(el.textContent ?? ''));
    expect(hasNameless).toBe(true);
  });

  it('does not show "Used in processes" when landmark has no connections in any stage', () => {
    // Landmark with no connections at all
    const isolatedLandmark = { id: 'lm3', name: 'Isolated', ownerId: 'p1', coordinate: { q: 5, r: 5 }, type: 'KEEP' as const };
    useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
    useMapStore.setState({
      currentMap: {
        ...MAP_BASE,
        landmarks: { ...MAP_BASE.landmarks, lm3: isolatedLandmark },
      },
      processes: PROCESS_WITH_STAGES,
      processesFetched: true, processesLoading: false, processesError: null,
      processMode: true, activeProcessId: null, activeStageId: null,
      mainView: 'process',
      selectedLandmark: isolatedLandmark,
      selectedConnectionId: null,
    });
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.queryByText('Used in processes')).not.toBeInTheDocument();
  });

  it('does not show "Used in processes" when there are no processes', () => {
    setupProcessMode(LANDMARK_LM1, []);
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.queryByText('Used in processes')).not.toBeInTheDocument();
  });

  it('clicking a process stage entry calls setActiveProcessId and setActiveStageId', () => {
    setupProcessMode();
    render(<Sidebar {...DEFAULT_PROPS} />);
    const stageBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.includes('Alpha Flow') && b.textContent?.includes('Intake'),
    )!;
    expect(stageBtn).toBeDefined();
    fireEvent.click(stageBtn);
    const state = useMapStore.getState();
    expect(state.activeProcessId).toBe('proc-1');
    expect(state.activeStageId).toBe('stage-1');
  });

  it('clicking a process stage entry clears selectedLandmark and selectedTile', () => {
    setupProcessMode();
    render(<Sidebar {...DEFAULT_PROPS} />);
    const stageBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.includes('Alpha Flow') && b.textContent?.includes('Intake'),
    )!;
    fireEvent.click(stageBtn);
    const state = useMapStore.getState();
    expect(state.selectedLandmark).toBeNull();
    expect(state.selectedTile).toBeNull();
  });

  it('close button clears selectedLandmark and selectedTile', () => {
    setupProcessMode();
    render(<Sidebar {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByLabelText('Back to process'));
    const state = useMapStore.getState();
    expect(state.selectedLandmark).toBeNull();
    expect(state.selectedTile).toBeNull();
  });

  it('deduplicates process stages — same stage listed only once even if landmark has multiple matching connections', () => {
    // Stage has both c1 and c2 (both touch lm1), so that stage should appear only once
    const bothConnsInOneStage: Process[] = [{
      id: 'proc-x',
      name: 'Combined Flow',
      stages: [{
        id: 'stage-x',
        order: 0,
        name: 'All in one',
        connections: [
          { id: 'sc-x1', connectionId: 'c1', direction: 'FORWARD' as const },
          { id: 'sc-x2', connectionId: 'c2', direction: 'FORWARD' as const },
        ],
      }],
    }];
    setupProcessMode(LANDMARK_LM1, bothConnsInOneStage);
    render(<Sidebar {...DEFAULT_PROPS} />);
    const entries = screen.getAllByText('Combined Flow');
    expect(entries).toHaveLength(1);
  });
});

// ── Store: setProcessMode resets sidebar state ────────────────────────────────

describe('setProcessMode – sidebar state reset', () => {
  it('clears selectedLandmark, selectedTile and selectedConnectionId when entering process mode', () => {
    useMapStore.setState({
      selectedLandmark: LANDMARK_LM1,
      selectedTile: { q: 0, r: 0 },
      selectedConnectionId: 'c1',
      processMode: false,
      mainView: 'landmark',
    });

    useMapStore.getState().setProcessMode(true);

    const state = useMapStore.getState();
    expect(state.selectedLandmark).toBeNull();
    expect(state.selectedTile).toBeNull();
    expect(state.selectedConnectionId).toBeNull();
    expect(state.processMode).toBe(true);
    expect(state.mainView).toBe('process');
  });

  it('does not clear sidebar state when leaving process mode', () => {
    useMapStore.setState({
      selectedLandmark: LANDMARK_LM1,
      selectedTile: { q: 0, r: 0 },
      processMode: true,
      mainView: 'process',
    });

    useMapStore.getState().setProcessMode(false);

    const state = useMapStore.getState();
    // selectedLandmark and selectedTile are preserved when leaving process mode
    expect(state.selectedLandmark?.id).toBe('lm1');
    expect(state.processMode).toBe(false);
  });
});


describe('Sidebar – ProcessLandmarkView integration (simulated tile click)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows ProcessLandmarkView with related processes after setSelectedLandmark is called', () => {
    useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
    useMapStore.setState({
      currentMap: MAP_BASE,
      processes: PROCESS_WITH_STAGES,
      processesFetched: true, processesLoading: false, processesError: null,
      processMode: true, activeProcessId: null, activeStageId: null,
      mainView: 'process',
      selectedLandmark: null,
      selectedConnectionId: null,
    });

    render(<Sidebar {...DEFAULT_PROPS} />);

    // Initially ProcessPanel is shown, not ProcessLandmarkView
    expect(screen.queryByText('Used in processes')).not.toBeInTheDocument();

    // Simulate ProcessMapView.handleTileClick → landmark found → setSelectedLandmark
    act(() => {
      useMapStore.getState().setSelectedLandmark(LANDMARK_LM1);
      useMapStore.getState().setSelectedTile({ q: 0, r: 0 });
    });

    // Now ProcessLandmarkView must appear with related processes
    expect(screen.getByText('Iron Keep')).toBeInTheDocument();
    expect(screen.getByText('Used in processes')).toBeInTheDocument();
    expect(screen.getAllByText('Alpha Flow').length).toBeGreaterThanOrEqual(1);
  });

  it('processMode stays true after setSelectedLandmark — no setMainView called in ProcessMapView', () => {
    useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
    useMapStore.setState({
      currentMap: MAP_BASE,
      processes: PROCESS_WITH_STAGES,
      processesFetched: true, processesLoading: false, processesError: null,
      processMode: true, mainView: 'process',
      selectedLandmark: null, selectedConnectionId: null,
    });

    // Simulate tile click (only setSelectedLandmark + setSelectedTile, no setMainView)
    useMapStore.getState().setSelectedLandmark(LANDMARK_LM1);

    const state = useMapStore.getState();
    expect(state.processMode).toBe(true);
    expect(state.mainView).toBe('process');
    expect(state.selectedLandmark?.id).toBe('lm1');
  });
});

// ── "Used in processes" coverage ─────────────────────────────────────────────

describe('Sidebar – ProcessLandmarkView "Used in processes" coverage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows stages when landmark is the CONNECTION ORIGIN (c1: lm1→lm2, selecting lm1)', () => {
    setupProcessMode(LANDMARK_LM1);
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getByText('Used in processes')).toBeInTheDocument();
  });

  it('shows stages when landmark is the CONNECTION TARGET (c1: lm1→lm2, selecting lm2)', () => {
    setupProcessMode(LANDMARK_LM2);
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getByText('Used in processes')).toBeInTheDocument();
  });

  it('shows stages from ALL processes regardless of which process is activeProcessId', () => {
    useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
    useMapStore.setState({
      currentMap: MAP_BASE,
      processes: PROCESS_WITH_STAGES,
      processesFetched: true, processesLoading: false, processesError: null,
      processMode: true,
      activeProcessId: 'proc-1',   // only proc-1 is "active"
      activeStageId: null,
      mainView: 'process',
      selectedLandmark: LANDMARK_LM1,
      selectedConnectionId: null,
    });
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getAllByText('Alpha Flow').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Beta Flow')).toBeInTheDocument();
  });

  it('shows stages from ALL processes when a different process is active (proc-2)', () => {
    useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
    useMapStore.setState({
      currentMap: MAP_BASE,
      processes: PROCESS_WITH_STAGES,
      processesFetched: true, processesLoading: false, processesError: null,
      processMode: true,
      activeProcessId: 'proc-2',   // proc-2 active, but proc-1 must still appear
      activeStageId: null,
      mainView: 'process',
      selectedLandmark: LANDMARK_LM1,
      selectedConnectionId: null,
    });
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getAllByText('Alpha Flow').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Beta Flow').length).toBeGreaterThanOrEqual(1);
  });

  it('shows BOTH stages of proc-1 because lm1 appears in c1 (origin) and c2 (target)', () => {
    // stage-1 has c1 (lm1→lm2), stage-2 has c2 (lm2→lm1) — both touch lm1
    setupProcessMode(LANDMARK_LM1);
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getByText('Stage 1: Intake')).toBeInTheDocument();
    expect(screen.getByText('Stage 2: Output')).toBeInTheDocument();
  });

  it('selecting lm2 (target of c1, origin of c2) shows both matching stages', () => {
    setupProcessMode(LANDMARK_LM2);
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getByText('Stage 1: Intake')).toBeInTheDocument();
    expect(screen.getByText('Stage 2: Output')).toBeInTheDocument();
  });

  it('landmark that only appears as TARGET of a connection is still matched', () => {
    const lm3 = { id: 'lm3', name: 'Fort', ownerId: 'p1', coordinate: { q: 5, r: 0 }, type: 'KEEP' as const };
    const processes: Process[] = [{
      id: 'proc-x', name: 'X Flow',
      stages: [{ id: 'sx', order: 0, name: 'Step', connections: [{ id: 'scx', connectionId: 'cx', direction: 'FORWARD' as const }] }],
    }];
    useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
    useMapStore.setState({
      currentMap: {
        ...MAP_BASE,
        landmarks: { ...MAP_BASE.landmarks, lm3 },
        connections: {
          ...MAP_BASE.connections,
          cx: { id: 'cx', originId: 'lm1', targetId: 'lm3', path: [], type: 'PIPE' as const },
        },
      },
      processes,
      processesFetched: true, processesLoading: false, processesError: null,
      processMode: true, activeProcessId: null, activeStageId: null,
      mainView: 'process', selectedLandmark: lm3, selectedConnectionId: null,
    });
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getByText('Used in processes')).toBeInTheDocument();
    expect(screen.getByText('X Flow')).toBeInTheDocument();
  });

  it('landmark that only appears as ORIGIN of a connection is still matched', () => {
    const processes: Process[] = [{
      id: 'po', name: 'Origin Flow',
      stages: [{ id: 'so', order: 0, name: 'Only Stage', connections: [{ id: 'sco', connectionId: 'c1', direction: 'FORWARD' as const }] }],
    }];
    useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
    useMapStore.setState({
      currentMap: MAP_BASE,
      processes, processesFetched: true, processesLoading: false, processesError: null,
      processMode: true, activeProcessId: null, activeStageId: null,
      mainView: 'process', selectedLandmark: LANDMARK_LM1, selectedConnectionId: null,
    });
    render(<Sidebar {...DEFAULT_PROPS} />);
    expect(screen.getByText('Used in processes')).toBeInTheDocument();
    expect(screen.getByText('Origin Flow')).toBeInTheDocument();
  });
});

