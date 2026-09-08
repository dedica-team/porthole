import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultSessionId,
  setDefaultSessionId,
  clearDefaultSessionId,
  resolveDefaultSessionId,
} from '../utils/sessionCookies';
import type { SessionState } from '../types/session';

function clearAllCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  });
}

const makeMap = (id: string): SessionState => ({
  id,
  createdAt: new Date().toISOString(),
  collaborators: [],
  landmarks: {},
  connections: {},
  groups: {},
  map: { tiles: [] },
});

beforeEach(() => {
  clearAllCookies();
});

describe('sessionCookies – get/set/clear', () => {
  it('returns null when no cookie has been set for the user', () => {
    expect(getDefaultSessionId('user-1')).toBeNull();
  });

  it('stores and retrieves the default session id for a user', () => {
    setDefaultSessionId('user-1', 'session-abc');
    expect(getDefaultSessionId('user-1')).toBe('session-abc');
  });

  it('keeps default session ids separate per user', () => {
    setDefaultSessionId('user-1', 'session-abc');
    setDefaultSessionId('user-2', 'session-xyz');
    expect(getDefaultSessionId('user-1')).toBe('session-abc');
    expect(getDefaultSessionId('user-2')).toBe('session-xyz');
  });

  it('overwrites a previously stored default session id', () => {
    setDefaultSessionId('user-1', 'session-abc');
    setDefaultSessionId('user-1', 'session-def');
    expect(getDefaultSessionId('user-1')).toBe('session-def');
  });

  it('clears the stored default session id', () => {
    setDefaultSessionId('user-1', 'session-abc');
    clearDefaultSessionId('user-1');
    expect(getDefaultSessionId('user-1')).toBeNull();
  });

  it('url-encodes/decodes session ids with special characters', () => {
    setDefaultSessionId('user-1', 'session with spaces/&');
    expect(getDefaultSessionId('user-1')).toBe('session with spaces/&');
  });

  it('does nothing when userId is empty', () => {
    setDefaultSessionId('', 'session-abc');
    expect(getDefaultSessionId('')).toBeNull();
  });
});

describe('resolveDefaultSessionId', () => {
  it('returns null when the maps list is empty', () => {
    expect(resolveDefaultSessionId([], 'user-1')).toBeNull();
  });

  it('returns null when no cookie is set', () => {
    const maps = [makeMap('m1'), makeMap('m2')];
    expect(resolveDefaultSessionId(maps, 'user-1')).toBeNull();
  });

  it('returns the cookie-stored session id when it still exists in the list', () => {
    const maps = [makeMap('m1'), makeMap('m2')];
    setDefaultSessionId('user-1', 'm2');
    expect(resolveDefaultSessionId(maps, 'user-1')).toBe('m2');
  });

  it('returns null when the cookie-stored session no longer exists', () => {
    const maps = [makeMap('m1'), makeMap('m2')];
    setDefaultSessionId('user-1', 'deleted-session');
    expect(resolveDefaultSessionId(maps, 'user-1')).toBeNull();
  });

  it('returns null when another user has a cookie but this user does not', () => {
    const maps = [makeMap('m1'), makeMap('m2')];
    setDefaultSessionId('user-2', 'm2');
    expect(resolveDefaultSessionId(maps, 'user-1')).toBeNull();
  });
});

