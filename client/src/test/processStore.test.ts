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
    processMode: false,
    activeProcessId: null,
    activeStageId: null,
    processes: [],
    processesFetched: false,
    processesLoading: false,
    processesError: null,
    editorMode: false,
    mainView: 'metrics',
  });
});

// ── setProcessMode ────────────────────────────────────────────────────────────

describe('mapStore – setProcessMode', () => {
  it('activates process mode and sets mainView to process', () => {
    useMapStore.getState().setProcessMode(true);
    const s = useMapStore.getState();
    expect(s.processMode).toBe(true);
    expect(s.mainView).toBe('process');
  });

  it('deactivates process mode without changing mainView', () => {
    useMapStore.getState().setProcessMode(true);
    useMapStore.getState().setProcessMode(false);
    expect(useMapStore.getState().processMode).toBe(false);
  });

  it('enabling process mode disables editorMode', () => {
    useMapStore.setState({ editorMode: true });
    useMapStore.getState().setProcessMode(true);
    expect(useMapStore.getState().editorMode).toBe(false);
  });
});

// ── setEditorMode mutual exclusion ─────────────────────────────────────────────

describe('mapStore – setEditorMode mutual exclusion with processMode', () => {
  it('enabling editorMode disables processMode', () => {
    useMapStore.getState().setProcessMode(true);
    useMapStore.getState().setEditorMode(true);
    expect(useMapStore.getState().processMode).toBe(false);
    expect(useMapStore.getState().editorMode).toBe(true);
  });
});

// ── setMainView mutual exclusion ──────────────────────────────────────────────

describe('mapStore – setMainView clears processMode for non-process views', () => {
  it('switching to metrics clears processMode', () => {
    useMapStore.getState().setProcessMode(true);
    useMapStore.getState().setMainView('metrics');
    expect(useMapStore.getState().processMode).toBe(false);
  });

  it('switching to idle clears processMode', () => {
    useMapStore.getState().setProcessMode(true);
    useMapStore.getState().setMainView('idle');
    expect(useMapStore.getState().processMode).toBe(false);
  });

  it('switching to process view preserves processMode', () => {
    useMapStore.getState().setProcessMode(true);
    useMapStore.getState().setMainView('process');
    expect(useMapStore.getState().processMode).toBe(true);
  });
});

// ── setCurrentMap resets process state ───────────────────────────────────────

describe('mapStore – setCurrentMap resets process state', () => {
  it('resets processes and fetchedFlag when map changes', () => {
    useMapStore.setState({
      currentMap: makeMap(),
      processes: [{ id: 'p1', name: 'Old', stages: [] }],
      processesFetched: true,
      processMode: true,
    });
    useMapStore.getState().setCurrentMap({ ...makeMap(), id: 'map-2' });
    const s = useMapStore.getState();
    expect(s.processes).toHaveLength(0);
    expect(s.processesFetched).toBe(false);
    expect(s.processMode).toBe(false);
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

