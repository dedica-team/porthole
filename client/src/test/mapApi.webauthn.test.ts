import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bufferToBase64url, base64urlToBuffer, webauthnRegisterStart, webauthnAuthStart } from '../api/mapApi';

// ── Base64url helpers ─────────────────────────────────────────────────────────

describe('bufferToBase64url / base64urlToBuffer', () => {
  it('round-trips an ArrayBuffer correctly', () => {
    const original = new Uint8Array([1, 2, 3, 255, 0, 128]).buffer;
    const encoded = bufferToBase64url(original);
    const decoded = base64urlToBuffer(encoded);
    expect(new Uint8Array(decoded)).toEqual(new Uint8Array(original));
  });

  it('produces URL-safe characters (no +, /, =)', () => {
    const buf = new Uint8Array(32).fill(0xfa).buffer;
    const encoded = bufferToBase64url(buf);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('handles empty buffer', () => {
    const encoded = bufferToBase64url(new ArrayBuffer(0));
    expect(encoded).toBe('');
    const decoded = base64urlToBuffer(encoded);
    expect(decoded.byteLength).toBe(0);
  });
});

// ── webauthnRegisterStart ─────────────────────────────────────────────────────

describe('webauthnRegisterStart', () => {
  const mockResponse = {
    sessionId: 's1',
    challenge: 'Y2hhbGxlbmdl',
    rp: { id: 'localhost', name: 'Landmarks' },
    user: { id: 'u1', name: 'alice', displayName: 'alice' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
    timeout: 60000,
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse),
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends POST to /api/auth/webauthn/register/start', async () => {
    await webauthnRegisterStart('alice');
    const [url, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/webauthn/register/start');
    expect(init.method).toBe('POST');
  });

  it('sends username in request body', async () => {
    await webauthnRegisterStart('alice');
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { username: string };
    expect(body.username).toBe('alice');
  });

  it('returns the parsed response', async () => {
    const result = await webauthnRegisterStart('alice');
    expect(result.sessionId).toBe('s1');
    expect(result.challenge).toBe('Y2hhbGxlbmdl');
  });
});

// ── webauthnAuthStart ─────────────────────────────────────────────────────────

describe('webauthnAuthStart', () => {
  const mockResponse = {
    sessionId: 's2',
    challenge: 'dGVzdA',
    allowCredentials: [],
    userVerification: 'preferred',
    timeout: 60000,
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse),
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends POST to /api/auth/webauthn/authenticate/start', async () => {
    await webauthnAuthStart();
    const [url] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/webauthn/authenticate/start');
  });

  it('sends null username when called without argument', async () => {
    await webauthnAuthStart();
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { username: null };
    expect(body.username).toBeNull();
  });

  it('sends username in body when provided', async () => {
    await webauthnAuthStart('alice');
    const [, init] = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { username: string };
    expect(body.username).toBe('alice');
  });
});

