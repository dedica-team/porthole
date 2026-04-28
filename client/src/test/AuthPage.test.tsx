import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthPage from '../pages/AuthPage/AuthPage';
import * as mapApi from '../api/mapApi';
import { useAuthStore } from '../store/mapStore';

vi.mock('../api/mapApi');

function renderAuthPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/lobby" element={<div data-testid="lobby-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockAuthResponse = {
  token: 'jwt-token',
  userId: 'u1',
  username: 'alice',
  avatarUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    token: null,
    userId: null,
    username: null,
    avatarUrl: null,
    isAuthenticated: false,
  });

  // Default: GitHub is enabled
  vi.mocked(mapApi.getAuthFeatures).mockResolvedValue({ githubEnabled: true, keycloakEnabled: false, webAuthnEnabled: false });

  // Default: GitHub config returns a clientId
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ githubClientId: 'test-gh-client-id' }),
    text: async () => '',
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Feature detection ─────────────────────────────────────────────────────────

describe('AuthPage – WebAuthn feature detection', () => {
  it('does not render Passkey button when PublicKeyCredential is undefined', () => {
    vi.stubGlobal('PublicKeyCredential', undefined);
    renderAuthPage();
    expect(screen.queryByRole('button', { name: /sign in with passkey/i })).not.toBeInTheDocument();
  });

  it('renders Passkey button when PublicKeyCredential is defined', () => {
    vi.stubGlobal('PublicKeyCredential', class {});
    renderAuthPage();
    expect(screen.getByRole('button', { name: /sign in with passkey/i })).toBeInTheDocument();
  });

  it('GitHub button visible when githubEnabled is true', async () => {
    renderAuthPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /access via github/i })).toBeInTheDocument()
    );
  });

  it('GitHub button hidden when githubEnabled is false', async () => {
    vi.mocked(mapApi.getAuthFeatures).mockResolvedValue({ githubEnabled: false, keycloakEnabled: false, webAuthnEnabled: false });
    renderAuthPage();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /access via github/i })).not.toBeInTheDocument();
    });
  });

  it('both buttons visible when WebAuthn is supported', async () => {
    vi.mocked(mapApi.getAuthFeatures).mockResolvedValue({ githubEnabled: true, keycloakEnabled: false, webAuthnEnabled: true });
    vi.stubGlobal('PublicKeyCredential', class {});
    renderAuthPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /access via github/i })).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /sign in with passkey/i })).toBeInTheDocument();
  });
});

// ── Discoverable auth flow ────────────────────────────────────────────────────

describe('AuthPage – Passkey discoverable login', () => {
  beforeEach(() => {
    vi.stubGlobal('PublicKeyCredential', class {});
  });

  it('calls webauthnAuthStart with no username on button click', async () => {
    vi.mocked(mapApi.webauthnAuthStart).mockResolvedValue({
      sessionId: 's1',
      challenge: 'Y2hhbGxlbmdl',
      allowCredentials: [],
      userVerification: 'preferred',
      timeout: 60000,
    });

    const mockCred = { id: 'cred-id', rawId: new ArrayBuffer(8), type: 'public-key', response: { clientDataJSON: new ArrayBuffer(0), authenticatorData: new ArrayBuffer(0), signature: new ArrayBuffer(0), userHandle: null } };
    vi.stubGlobal('navigator', {
      credentials: { get: vi.fn().mockResolvedValue(mockCred) },
    });
    vi.mocked(mapApi.webauthnAuthFinish).mockResolvedValue(mockAuthResponse);

    renderAuthPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in with passkey/i }));

    await waitFor(() => expect(mapApi.webauthnAuthStart).toHaveBeenCalledOnce());
  });

  it('navigates to /lobby on successful discoverable auth', async () => {
    vi.mocked(mapApi.webauthnAuthStart).mockResolvedValue({
      sessionId: 's1',
      challenge: 'Y2hhbGxlbmdl',
      allowCredentials: [],
      userVerification: 'preferred',
      timeout: 60000,
    });

    const mockCred = { id: 'cred-id', rawId: new ArrayBuffer(8), type: 'public-key', response: { clientDataJSON: new ArrayBuffer(0), authenticatorData: new ArrayBuffer(0), signature: new ArrayBuffer(0), userHandle: null } };
    vi.stubGlobal('navigator', {
      credentials: { get: vi.fn().mockResolvedValue(mockCred) },
    });
    vi.mocked(mapApi.webauthnAuthFinish).mockResolvedValue(mockAuthResponse);

    renderAuthPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in with passkey/i }));

    await waitFor(() => expect(screen.getByTestId('lobby-page')).toBeInTheDocument());
  });

  it('shows username modal when auth throws NotAllowedError', async () => {
    vi.mocked(mapApi.webauthnAuthStart).mockRejectedValue(
      Object.assign(new DOMException('User cancelled', 'NotAllowedError')),
    );

    renderAuthPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in with passkey/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /passkey/i })).toBeInTheDocument(),
    );
  });

  it('shows username modal when navigator.credentials.get returns null', async () => {
    vi.mocked(mapApi.webauthnAuthStart).mockResolvedValue({
      sessionId: 's1',
      challenge: 'Y2hhbGxlbmdl',
      allowCredentials: [],
      userVerification: 'preferred',
      timeout: 60000,
    });
    vi.stubGlobal('navigator', {
      credentials: { get: vi.fn().mockResolvedValue(null) },
    });

    renderAuthPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in with passkey/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /passkey/i })).toBeInTheDocument(),
    );
  });
});

// ── Username modal ────────────────────────────────────────────────────────────

describe('AuthPage – Passkey modal', () => {
  beforeEach(() => {
    vi.stubGlobal('PublicKeyCredential', class {});
    // Make discoverable auth fail immediately to open modal
    vi.mocked(mapApi.webauthnAuthStart).mockRejectedValueOnce(
      Object.assign(new DOMException('User cancelled', 'NotAllowedError')),
    );
  });

  async function openModal() {
    renderAuthPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in with passkey/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /passkey/i })).toBeInTheDocument(),
    );
  }

  it('closes modal when X is clicked', async () => {
    await openModal();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /passkey/i })).not.toBeInTheDocument(),
    );
  });

  it('Register button is disabled when username is empty', async () => {
    await openModal();
    expect(screen.getByRole('button', { name: /register new passkey/i })).toBeDisabled();
  });

  it('Register button enabled after typing username', async () => {
    await openModal();
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'bob' } });
    expect(screen.getByRole('button', { name: /register new passkey/i })).not.toBeDisabled();
  });

  it('calls webauthnRegisterStart with typed username on Register click', async () => {
    vi.mocked(mapApi.webauthnRegisterStart).mockResolvedValue({
      sessionId: 's2',
      challenge: 'Y2hhbGxlbmdl',
      rp: { id: 'localhost', name: 'Landmarks' },
      user: { id: 'u-new', name: 'bob', displayName: 'bob' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
      timeout: 60000,
    });

    const mockCred = { id: 'cred-id', rawId: new ArrayBuffer(8), type: 'public-key', response: { clientDataJSON: new ArrayBuffer(0), attestationObject: new ArrayBuffer(0) } };
    vi.stubGlobal('navigator', {
      credentials: { create: vi.fn().mockResolvedValue(mockCred), get: vi.fn() },
    });
    vi.mocked(mapApi.webauthnRegisterFinish).mockResolvedValue(mockAuthResponse);

    await openModal();
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'bob' } });
    fireEvent.click(screen.getByRole('button', { name: /register new passkey/i }));

    await waitFor(() => expect(mapApi.webauthnRegisterStart).toHaveBeenCalledWith('bob'));
  });

  it('navigates to /lobby on successful registration', async () => {
    vi.mocked(mapApi.webauthnRegisterStart).mockResolvedValue({
      sessionId: 's2',
      challenge: 'Y2hhbGxlbmdl',
      rp: { id: 'localhost', name: 'Landmarks' },
      user: { id: 'u-new', name: 'bob', displayName: 'bob' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
      timeout: 60000,
    });

    const mockCred = { id: 'cred-id', rawId: new ArrayBuffer(8), type: 'public-key', response: { clientDataJSON: new ArrayBuffer(0), attestationObject: new ArrayBuffer(0) } };
    vi.stubGlobal('navigator', {
      credentials: { create: vi.fn().mockResolvedValue(mockCred), get: vi.fn() },
    });
    vi.mocked(mapApi.webauthnRegisterFinish).mockResolvedValue(mockAuthResponse);

    await openModal();
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'bob' } });
    fireEvent.click(screen.getByRole('button', { name: /register new passkey/i }));

    await waitFor(() => expect(screen.getByTestId('lobby-page')).toBeInTheDocument());
  });

  it('shows error alert when registration fails with server error', async () => {
    vi.mocked(mapApi.webauthnRegisterStart).mockRejectedValue(new Error('HTTP 400'));

    await openModal();
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'bob' } });
    fireEvent.click(screen.getByRole('button', { name: /register new passkey/i }));

    await waitFor(() => expect(screen.getByText('HTTP 400')).toBeInTheDocument());
  });
});

