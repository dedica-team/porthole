import type { NavigateFunction } from 'react-router-dom';
import { listMaps } from '@/api/mapApi';
import type { SessionState } from '@/types/session';
import { resolveDefaultSessionId } from './sessionCookies';

/**
 * After login: loads the session list, determines the user's default
 * session (previously chosen one via cookie, if the user is a collaborator
 * in it) and navigates straight into it. Falls back to the lobby if no
 * matching session is available or the list could not be loaded.
 */
export async function enterDefaultSession(
  userId: string,
  navigate: NavigateFunction,
  setMaps: (maps: SessionState[]) => void,
  setCurrentMap: (map: SessionState | null) => void,
): Promise<void> {
  try {
    const maps = await listMaps();
    setMaps(maps);
    const defaultId = resolveDefaultSessionId(maps, userId);
    const map = defaultId ? maps.find((m) => m.id === defaultId) : undefined;
    if (map && map.collaborators?.some((c) => c.id === userId)) {
      setCurrentMap(map);
      navigate(`/session/${map.id}`, { replace: true });
      return;
    }
  } catch {
    // ignore and fall back to the lobby below
  }
  navigate('/lobby', { replace: true });
}

