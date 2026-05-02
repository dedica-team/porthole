import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchChoreLists,
  createChoreList,
  editChoreList,
  toggleChoreListCompleted,
  deleteChoreList,
  updateChoreEntry,
} from '../api/mapApi';
import type { ChoreList } from '../types/chores';
const MAP_ID  = 'map-1';
const LIST_ID = 'list-1';
const LM_ID   = 'lm-1';

const mockList: ChoreList = {
  id: LIST_ID,
  title: 'Sprint Audit',
  completed: false,
  link: undefined,
  entries: {
    [LM_ID]: { landmarkId: LM_ID, state: 'NONE' },
  },
};

function mockFetch(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }));
}

function mockFetch204() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null, text: async () => '' }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

// ── fetchChoreLists ───────────────────────────────────────────────────────────

describe('fetchChoreLists', () => {
  it('sends GET to correct URL', async () => {
    mockFetch([mockList]);
    await fetchChoreLists(MAP_ID);
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/chore-lists`);
    expect(init?.method).toBeUndefined();
  });

  it('returns parsed list array', async () => {
    mockFetch([mockList]);
    const result = await fetchChoreLists(MAP_ID);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Sprint Audit');
  });

  it('throws on non-ok response', async () => {
    mockFetch({ message: 'Forbidden' }, false);
    await expect(fetchChoreLists(MAP_ID)).rejects.toThrow('Forbidden');
  });
});

// ── createChoreList ───────────────────────────────────────────────────────────

describe('createChoreList', () => {
  it('sends POST with title, landmarkIds and link', async () => {
    mockFetch([mockList]);
    await createChoreList(MAP_ID, 'Sprint Audit', [LM_ID], 'https://wiki.example');
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/chore-lists`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe('Sprint Audit');
    expect(body.landmarkIds).toEqual([LM_ID]);
    expect(body.link).toBe('https://wiki.example');
  });

  it('sends null for link when omitted', async () => {
    mockFetch([mockList]);
    await createChoreList(MAP_ID, 'Audit', []);
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).link).toBeNull();
  });

  it('returns parsed list array', async () => {
    mockFetch([mockList]);
    const result = await createChoreList(MAP_ID, 'Sprint Audit', []);
    expect(result[0].id).toBe(LIST_ID);
  });

  it('throws on error', async () => {
    mockFetch({ message: 'Bad request' }, false);
    await expect(createChoreList(MAP_ID, '', [])).rejects.toThrow('Bad request');
  });
});

// ── editChoreList ─────────────────────────────────────────────────────────────

describe('editChoreList', () => {
  it('sends PATCH with title, landmarkIds, link and clearLink', async () => {
    mockFetch([mockList]);
    await editChoreList(MAP_ID, LIST_ID, 'New Title', [LM_ID], 'https://example.com');
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/chore-lists/${LIST_ID}`);
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe('New Title');
    expect(body.link).toBe('https://example.com');
    expect(body.clearLink).toBe(false);
  });

  it('sets clearLink=true when link is undefined', async () => {
    mockFetch([mockList]);
    await editChoreList(MAP_ID, LIST_ID, 'Title', undefined, undefined);
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.clearLink).toBe(true);
  });
});

// ── toggleChoreListCompleted ──────────────────────────────────────────────────

describe('toggleChoreListCompleted', () => {
  it('sends PATCH to /complete endpoint', async () => {
    mockFetch({ ...mockList, completed: true });
    await toggleChoreListCompleted(MAP_ID, LIST_ID);
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/chore-lists/${LIST_ID}/complete`);
    expect(init.method).toBe('PATCH');
  });

  it('returns updated list', async () => {
    mockFetch({ ...mockList, completed: true });
    const result = await toggleChoreListCompleted(MAP_ID, LIST_ID);
    expect(result.completed).toBe(true);
  });
});

// ── deleteChoreList ───────────────────────────────────────────────────────────

describe('deleteChoreList', () => {
  it('sends DELETE to correct URL', async () => {
    mockFetch204();
    await deleteChoreList(MAP_ID, LIST_ID);
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/chore-lists/${LIST_ID}`);
    expect(init.method).toBe('DELETE');
  });

  it('throws on non-ok response', async () => {
    mockFetch({ message: 'Not found' }, false);
    await expect(deleteChoreList(MAP_ID, LIST_ID)).rejects.toThrow();
  });
});

// ── updateChoreEntry ──────────────────────────────────────────────────────────

describe('updateChoreEntry', () => {
  it('sends PATCH to correct URL', async () => {
    mockFetch(mockList);
    await updateChoreEntry(MAP_ID, LIST_ID, LM_ID, { state: 'DONE' });
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/chore-lists/${LIST_ID}/entries/${LM_ID}`);
    expect(init.method).toBe('PATCH');
  });

  it('serialises state patch', async () => {
    mockFetch(mockList);
    await updateChoreEntry(MAP_ID, LIST_ID, LM_ID, { state: 'BLOCKED' });
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).state).toBe('BLOCKED');
  });

  it('serialises assigneeId patch', async () => {
    mockFetch(mockList);
    await updateChoreEntry(MAP_ID, LIST_ID, LM_ID, { assigneeId: 'u1' });
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).assigneeId).toBe('u1');
  });

  it('serialises clearAssignee patch', async () => {
    mockFetch(mockList);
    await updateChoreEntry(MAP_ID, LIST_ID, LM_ID, { clearAssignee: true });
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).clearAssignee).toBe(true);
  });

  it('serialises link and note patch', async () => {
    mockFetch(mockList);
    await updateChoreEntry(MAP_ID, LIST_ID, LM_ID, { link: 'https://x.com', note: 'check this' });
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.link).toBe('https://x.com');
    expect(body.note).toBe('check this');
  });

  it('returns updated ChoreList', async () => {
    const updated = { ...mockList, entries: { [LM_ID]: { landmarkId: LM_ID, state: 'DONE' } } };
    mockFetch(updated);
    const result = await updateChoreEntry(MAP_ID, LIST_ID, LM_ID, { state: 'DONE' });
    expect(result.entries[LM_ID].state).toBe('DONE');
  });

  it('throws on error response', async () => {
    mockFetch({ message: 'Forbidden' }, false);
    await expect(updateChoreEntry(MAP_ID, LIST_ID, LM_ID, { state: 'DONE' })).rejects.toThrow('Forbidden');
  });
});

