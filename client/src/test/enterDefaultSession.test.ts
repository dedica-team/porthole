import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enterDefaultSession } from '../utils/enterDefaultSession';
import * as mapApi from '../api/mapApi';
import { setDefaultSessionId, clearDefaultSessionId } from '../utils/sessionCookies';
import type { SessionState } from '../types/session';

vi.mock('../api/mapApi');

const makeMap = (id: string): SessionState => ({
  id,
  createdAt: new Date().toISOString(),
  collaborators: [],
  landmarks: {},
  connections: {},
  groups: {},
  map: { tiles: [] },
});

const USER_ID = 'user-1';

beforeEach(() => {
  vi.clearAllMocks();
  clearDefaultSessionId(USER_ID);
});

describe('enterDefaultSession', () => {
  it('navigates to the lobby when sessions exist but no cookie is set', async () => {
    const maps = [makeMap('m1'), makeMap('m2')];
    vi.mocked(mapApi.listMaps).mockResolvedValue(maps);
    const navigate = vi.fn();
    const setMaps = vi.fn();
    const setCurrentMap = vi.fn();

    await enterDefaultSession(USER_ID, navigate, setMaps, setCurrentMap);

    expect(setMaps).toHaveBeenCalledWith(maps);
    expect(setCurrentMap).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/lobby', { replace: true });
  });

  it('navigates to the cookie-stored session when it still exists', async () => {
    const maps = [makeMap('m1'), makeMap('m2')];
    vi.mocked(mapApi.listMaps).mockResolvedValue(maps);
    setDefaultSessionId(USER_ID, 'm2');
    const navigate = vi.fn();
    const setMaps = vi.fn();
    const setCurrentMap = vi.fn();

    await enterDefaultSession(USER_ID, navigate, setMaps, setCurrentMap);

    expect(setCurrentMap).toHaveBeenCalledWith(maps[1]);
    expect(navigate).toHaveBeenCalledWith('/session/m2', { replace: true });
  });

  it('falls back to the lobby when there are no sessions', async () => {
    vi.mocked(mapApi.listMaps).mockResolvedValue([]);
    const navigate = vi.fn();
    const setMaps = vi.fn();
    const setCurrentMap = vi.fn();

    await enterDefaultSession(USER_ID, navigate, setMaps, setCurrentMap);

    expect(setCurrentMap).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/lobby', { replace: true });
  });

  it('falls back to the lobby when listMaps rejects', async () => {
    vi.mocked(mapApi.listMaps).mockRejectedValue(new Error('network error'));
    const navigate = vi.fn();
    const setMaps = vi.fn();
    const setCurrentMap = vi.fn();

    await enterDefaultSession(USER_ID, navigate, setMaps, setCurrentMap);

    expect(setCurrentMap).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/lobby', { replace: true });
  });
});

