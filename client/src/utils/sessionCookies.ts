import type { SessionState } from '@/types/session';

const COOKIE_PREFIX = 'porthole_default_session_';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function cookieName(userId: string): string {
  return `${COOKIE_PREFIX}${userId}`;
}

/** Reads the user's previously chosen default session id from a cookie. */
export function getDefaultSessionId(userId: string): string | null {
  if (typeof document === 'undefined' || !userId) return null;
  const name = cookieName(userId);
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

/** Persists the given session id as the user's new default session. */
export function setDefaultSessionId(userId: string, sessionId: string): void {
  if (typeof document === 'undefined' || !userId) return;
  document.cookie = `${cookieName(userId)}=${encodeURIComponent(sessionId)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

/** Removes the stored default session id for the given user. */
export function clearDefaultSessionId(userId: string): void {
  if (typeof document === 'undefined' || !userId) return;
  document.cookie = `${cookieName(userId)}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Resolves which session should be entered automatically after login:
 * the user's previously selected session (from cookie) if it still exists
 * in the given list and the user is a collaborator in it, otherwise null.
 */
export function resolveDefaultSessionId(maps: SessionState[], userId: string): string | null {
  if (!userId) return null;
  const cookieId = getDefaultSessionId(userId);
  if (cookieId) {
    const map = maps.find((m) => m.id === cookieId);
    if (map && map.collaborators?.some((c) => c.id === userId)) {
      return cookieId;
    }
  }
  return null;
}

