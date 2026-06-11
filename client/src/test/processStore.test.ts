import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/mapStore';
import type { SessionState } from '../types/session';

const makeMap = (): SessionState => ({
  id: 'map-1',
  createdAt: new Date().toISOString(),
  collaborators: [],
  joinRequests: [],
  landmarks: {},
  connections: {},
  groups: {},
  map: { tiles: [] },
});

beforeEach(() => {
  useMapStore.setState({
    currentMap: null,
    activeProcessId: null,
    activeStageId: null,
    processes: [],
    processesFetched: false,
    processesLoading: false,
    processesError: null,
    editorMode: false,
    mainView: 'idle',
  });
});

// ── setEditorMode ─────────────────────────────────────────────────────────────

describe('mapStore – setEditorMode', () => {
  it('enables editor mode', () => {
    useMapStore.getState().setEditorMode(true);
    expect(useMapStore.getState().editorMode).toBe(true);
  });

  it('disables editor mode', () => {
    useMapStore.getState().setEditorMode(true);
    useMapStore.getState().setEditorMode(false);
    expect(useMapStore.getState().editorMode).toBe(false);
  });
});

// ── setCurrentMap resets process state ───────────────────────────────────────

describe('mapStore – setCurrentMap resets process state', () => {
  it('resets processes and fetchedFlag when map changes', () => {
    useMapStore.setState({
      currentMap: makeMap(),
      processes: [{ id: 'p1', name: 'Old', stages: [] }],
      processesFetched: true,
      mainView: 'idle',
    });
    useMapStore.getState().setCurrentMap({ ...makeMap(), id: 'map-2' });
    const s = useMapStore.getState();
    expect(s.processes).toHaveLength(0);
    expect(s.processesFetched).toBe(false);
    expect(s.mainView).toBe('idle');
  });

  it('always resets processesFetched when setCurrentMap is called (forces re-fetch)', () => {
    const map = makeMap();
    useMapStore.setState({ currentMap: map, processesFetched: true });
    // Even the same map object triggers a reset so process data is always fresh
    useMapStore.getState().setCurrentMap(map);
    expect(useMapStore.getState().processesFetched).toBe(false);
  });
});

// ── setProcesses / setActiveProcessId / setActiveStageId ──────────────────────

describe('mapStore – process setters', () => {
  it('setProcesses stores the list', () => {
    useMapStore.getState().setProcesses([{ id: 'p1', name: 'Flow', stages: [] }]);
    expect(useMapStore.getState().processes).toHaveLength(1);
  });

  it('setActiveProcessId stores the id', () => {
    useMapStore.getState().setActiveProcessId('proc-123');
    expect(useMapStore.getState().activeProcessId).toBe('proc-123');
  });

  it('setActiveStageId stores the id', () => {
    useMapStore.getState().setActiveStageId('stage-456');
    expect(useMapStore.getState().activeStageId).toBe('stage-456');
  });

  it('setProcessesFetched updates the flag', () => {
    useMapStore.getState().setProcessesFetched(true);
    expect(useMapStore.getState().processesFetched).toBe(true);
  });

  it('setProcessesLoading updates the flag', () => {
    useMapStore.getState().setProcessesLoading(true);
    expect(useMapStore.getState().processesLoading).toBe(true);
  });

  it('setProcessesError stores error message', () => {
    useMapStore.getState().setProcessesError('Network error');
    expect(useMapStore.getState().processesError).toBe('Network error');
  });
});
