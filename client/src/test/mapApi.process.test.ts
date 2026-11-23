import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchProcesses,
  createProcess,
  editProcess,
  saveProcess,
  removeProcess,
  createProcessStage,
  removeProcessStage,
  addConnectionToStage,
  editStageConnection,
  removeConnectionFromStage,
} from '../api/mapApi';
import type { Process } from '../types/process';
const MAP_ID    = 'map-1';
const PROC_ID   = 'proc-1';
const STAGE_ID  = 'stage-1';
const CONN_ID   = 'conn-1';
const SC_ID     = 'sc-1';   // StageConnection own ID

const mockProcesses: Process[] = [
  {
    id: PROC_ID,
    name: 'Deploy Pipeline',
    description: 'Main pipeline',
    stages: [
      {
        id: STAGE_ID,
        name: 'Stage A',
        order: 0,
        connections: [{ id: SC_ID, connectionId: CONN_ID, direction: 'FORWARD' }],
      },
    ],
  },
];

function mockFetch(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

// ── fetchProcesses ────────────────────────────────────────────────────────────

describe('fetchProcesses', () => {
  it('sends GET to correct URL', async () => {
    mockFetch(mockProcesses);
    await fetchProcesses(MAP_ID);
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/processes`);
    expect(init.method).toBeUndefined(); // defaults to GET
  });

  it('returns the parsed process list', async () => {
    mockFetch(mockProcesses);
    const result = await fetchProcesses(MAP_ID);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Deploy Pipeline');
  });

  it('throws on non-ok response', async () => {
    mockFetch({ message: 'Forbidden' }, false);
    await expect(fetchProcesses(MAP_ID)).rejects.toThrow('Forbidden');
  });
});

// ── createProcess ─────────────────────────────────────────────────────────────

describe('createProcess', () => {
  it('sends POST with name and description', async () => {
    mockFetch(mockProcesses);
    await createProcess(MAP_ID, 'New Flow', 'desc');
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/processes`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { name: string; description: string };
    expect(body.name).toBe('New Flow');
    expect(body.description).toBe('desc');
  });

  it('sends null description when omitted', async () => {
    mockFetch(mockProcesses);
    await createProcess(MAP_ID, 'Flow');
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { description: null };
    expect(body.description).toBeNull();
  });
});

// ── editProcess ───────────────────────────────────────────────────────────────

describe('editProcess', () => {
  it('sends PATCH to correct URL', async () => {
    mockFetch(mockProcesses);
    await editProcess(MAP_ID, PROC_ID, 'Renamed');
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/processes/${PROC_ID}`);
    expect(init.method).toBe('PATCH');
  });
});

// ── saveProcess ───────────────────────────────────────────────────────────────

describe('saveProcess', () => {
  it('sends PUT with complete process data', async () => {
    mockFetch(mockProcesses);
    await saveProcess(MAP_ID, PROC_ID, {
      name: 'Full Process',
      description: 'Desc',
      stages: [
        {
          id: STAGE_ID,
          name: 'Stage 1',
          order: 0,
          connections: [{ id: SC_ID, connectionId: CONN_ID, direction: 'BIDIRECTIONAL' }],
        },
      ],
    });
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/processes/${PROC_ID}`);
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe('Full Process');
    expect(body.stages[0].connections[0].direction).toBe('BIDIRECTIONAL');
  });
});

// ── removeProcess ─────────────────────────────────────────────────────────────

describe('removeProcess', () => {
  it('sends DELETE to correct URL', async () => {
    mockFetch(mockProcesses);
    await removeProcess(MAP_ID, PROC_ID);
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/processes/${PROC_ID}`);
    expect(init.method).toBe('DELETE');
  });
});

// ── createProcessStage ────────────────────────────────────────────────────────

describe('createProcessStage', () => {
  it('sends POST with name and order', async () => {
    mockFetch(mockProcesses);
    await createProcessStage(MAP_ID, PROC_ID, 'Stage A', 0);
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/processes/${PROC_ID}/stages`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { name: string; order: number };
    expect(body.name).toBe('Stage A');
    expect(body.order).toBe(0);
  });

  it('sends null name when omitted', async () => {
    mockFetch(mockProcesses);
    await createProcessStage(MAP_ID, PROC_ID, undefined, 1);
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { name: null };
    expect(body.name).toBeNull();
  });
});

// ── removeProcessStage ────────────────────────────────────────────────────────

describe('removeProcessStage', () => {
  it('sends DELETE to correct URL', async () => {
    mockFetch(mockProcesses);
    await removeProcessStage(MAP_ID, PROC_ID, STAGE_ID);
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/processes/${PROC_ID}/stages/${STAGE_ID}`);
    expect(init.method).toBe('DELETE');
  });
});

// ── addConnectionToStage ──────────────────────────────────────────────────────

describe('addConnectionToStage', () => {
  it('sends POST with connectionId, title and direction', async () => {
    mockFetch(mockProcesses);
    await addConnectionToStage(MAP_ID, PROC_ID, STAGE_ID, CONN_ID, 'Send report', 'REVERSE');
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/processes/${PROC_ID}/stages/${STAGE_ID}/connections`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { connectionId: string; title: string; direction: string };
    expect(body.connectionId).toBe(CONN_ID);
    expect(body.title).toBe('Send report');
    expect(body.direction).toBe('REVERSE');
  });

  it('defaults title to null and direction to FORWARD when omitted', async () => {
    mockFetch(mockProcesses);
    await addConnectionToStage(MAP_ID, PROC_ID, STAGE_ID, CONN_ID);
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { title: null; direction: string };
    expect(body.title).toBeNull();
    expect(body.direction).toBe('FORWARD');
  });
});

// ── editStageConnection ───────────────────────────────────────────────────────

describe('editStageConnection', () => {
  it('sends PATCH to correct URL with patch body', async () => {
    mockFetch(mockProcesses);
    await editStageConnection(MAP_ID, PROC_ID, STAGE_ID, SC_ID, { direction: 'BIDIRECTIONAL' });
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/processes/${PROC_ID}/stages/${STAGE_ID}/connections/${SC_ID}`);
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string) as { direction: string };
    expect(body.direction).toBe('BIDIRECTIONAL');
  });
});

// ── removeConnectionFromStage ─────────────────────────────────────────────────

describe('removeConnectionFromStage', () => {
  it('sends DELETE to URL using stageConn own ID', async () => {
    mockFetch(mockProcesses);
    await removeConnectionFromStage(MAP_ID, PROC_ID, STAGE_ID, SC_ID);
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${MAP_ID}/processes/${PROC_ID}/stages/${STAGE_ID}/connections/${SC_ID}`);
    expect(init.method).toBe('DELETE');
  });
});

