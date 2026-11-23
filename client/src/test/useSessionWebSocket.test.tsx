import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionWebSocket } from '../hooks/useSessionWebSocket';
import { useMapStore } from '../store/mapStore';
import type { SessionState } from '../types/session';

const mocks = vi.hoisted(() => ({
  fetchProcesses: vi.fn(),
  clients: [] as { onConnect: () => void; subscriptions: Record<string, (message: { body: string }) => void>; deactivate: ReturnType<typeof vi.fn> }[],
}));

vi.mock('@stomp/stompjs', () => ({
  Client: class {
    onConnect: () => void;
    subscriptions: Record<string, (message: { body: string }) => void> = {};
    deactivate = vi.fn();
    constructor(config: { onConnect: () => void }) {
      this.onConnect = config.onConnect;
      mocks.clients.push(this);
    }
    subscribe(topic: string, callback: (message: { body: string }) => void) { this.subscriptions[topic] = callback; }
    activate() {}
  },
}));

vi.mock('../api/mapApi', () => ({
  getMap: vi.fn(),
  fetchMetrics: vi.fn(),
  fetchChoreLists: vi.fn(),
  fetchCollaboratorMatrix: vi.fn(),
  fetchGreenkeepingRotations: vi.fn(),
  fetchGameState: vi.fn(),
  fetchProcesses: mocks.fetchProcesses,
}));

const process = { id: 'p1', name: 'Flow', stages: [] };

beforeEach(() => {
  mocks.clients.length = 0;
  mocks.fetchProcesses.mockReset().mockResolvedValue([]);
  useMapStore.setState({ currentMap: { id: 'map-1' } as SessionState, processes: [], processesFetched: false });
});

describe('useSessionWebSocket processes', () => {
  it('refetches on a notification instead of trusting its body', async () => {
    mocks.fetchProcesses.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([process]);
    renderHook(() => useSessionWebSocket('map-1'));
    await waitFor(() => expect(useMapStore.getState().processesFetched).toBe(true));
    act(() => mocks.clients[0].onConnect());
    const callback = mocks.clients[0].subscriptions['/topic/map/map-1/processes'];
    expect(callback).toBeDefined();
    act(() => callback({ body: 'not a process snapshot' }));
    await waitFor(() => expect(useMapStore.getState().processes).toEqual([process]));
    expect(mocks.fetchProcesses).toHaveBeenCalledTimes(3);
    expect(mocks.fetchProcesses).toHaveBeenLastCalledWith('map-1');
    expect(useMapStore.getState().processesFetched).toBe(true);
  });

  it('hydrates again on reconnect and ignores pending results after unmount', async () => {
    let resolveReconnect!: (value: typeof process[]) => void;
    mocks.fetchProcesses.mockResolvedValueOnce([]).mockResolvedValueOnce([process]).mockReturnValueOnce(new Promise((resolve) => { resolveReconnect = resolve; }));
    const { unmount } = renderHook(() => useSessionWebSocket('map-1'));
    await waitFor(() => expect(mocks.fetchProcesses).toHaveBeenCalledTimes(1));
    act(() => mocks.clients[0].onConnect());
    await waitFor(() => expect(useMapStore.getState().processes).toEqual([process]));
    act(() => mocks.clients[0].onConnect());
    expect(mocks.fetchProcesses).toHaveBeenCalledTimes(3);
    unmount();
    await act(async () => { resolveReconnect([]); });
    expect(useMapStore.getState().processes).toEqual([process]);
  });

  it('does not let older reconnect or notification fetches overwrite newer results', async () => {
    let resolveReconnect!: (value: typeof process[]) => void;
    let resolveFirstNotification!: (value: typeof process[]) => void;
    mocks.fetchProcesses.mockResolvedValueOnce([])
      .mockReturnValueOnce(new Promise((resolve) => { resolveReconnect = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirstNotification = resolve; }))
      .mockResolvedValueOnce([process]);
    renderHook(() => useSessionWebSocket('map-1'));
    await waitFor(() => expect(useMapStore.getState().processesFetched).toBe(true));
    act(() => mocks.clients[0].onConnect());
    const callback = mocks.clients[0].subscriptions['/topic/map/map-1/processes'];
    act(() => { callback({ body: '' }); callback({ body: '' }); });
    await waitFor(() => expect(useMapStore.getState().processes).toEqual([process]));
    await act(async () => { resolveFirstNotification([]); resolveReconnect([]); });
    expect(useMapStore.getState().processes).toEqual([process]);
  });

  it('leaves processes unfetched when hydration and notification fetches fail', async () => {
    mocks.fetchProcesses.mockRejectedValue(new Error('offline'));
    renderHook(() => useSessionWebSocket('map-1'));
    act(() => mocks.clients[0].onConnect());
    act(() => mocks.clients[0].subscriptions['/topic/map/map-1/processes']({ body: 'invalid' }));
    await act(async () => {});
    expect(mocks.fetchProcesses).toHaveBeenCalledTimes(3);
    expect(useMapStore.getState().processes).toEqual([]);
    expect(useMapStore.getState().processesFetched).toBe(false);
  });
});