import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  githubStart,
  keycloakStart,
  getAuthFeatures,
  webauthnRegisterStart,
  webauthnRegisterFinish,
  webauthnAuthStart,
  webauthnAuthFinish,
  base64urlToBuffer,
} from '@/api/mapApi';
import { useAuthStore, useMapStore } from '@/store/mapStore';
import { enterDefaultSession } from '@/utils/enterDefaultSession';

export default function AuthPage() {
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [passkeyUsername, setPasskeyUsername] = useState('');
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [githubEnabled, setGithubEnabled] = useState<boolean | null>(null);
  const [keycloakEnabled, setKeycloakEnabled] = useState<boolean | null>(null);
  const [webAuthnServerEnabled, setWebAuthnServerEnabled] = useState<boolean>(true);
  const navigate = useNavigate();
  const authLogin = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionLoading = useAuthStore((s) => s.sessionLoading);
  const sessionResolved = useAuthStore((s) => s.sessionResolved);
  const tagline = useAuthStore((s) => s.tagline);
  const setTagline = useAuthStore((s) => s.setTagline);
  const userId = useAuthStore((s) => s.userId);
  const setMaps = useMapStore((s) => s.setMaps);
  const setCurrentMap = useMapStore((s) => s.setCurrentMap);

  const webAuthnSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential && webAuthnServerEnabled;

  useEffect(() => {
    if (sessionResolved && isAuthenticated && userId) {
      void enterDefaultSession(userId, navigate, setMaps, setCurrentMap);
    }
  }, [isAuthenticated, navigate, sessionResolved, userId, setMaps, setCurrentMap]);

  useEffect(() => {
    getAuthFeatures()
      .then((f) => { setGithubEnabled(f.githubEnabled); setKeycloakEnabled(f.keycloakEnabled); setWebAuthnServerEnabled(f.webAuthnEnabled ?? true); if (f.tagline) setTagline(f.tagline); })
      .catch(() => { setGithubEnabled(false); setKeycloakEnabled(false); });
  }, [setTagline]);

  const handleGitHubLogin = async () => {
    setOauthError(null);
    try {
      const { authorizationUrl } = await githubStart();
      window.location.assign(authorizationUrl);
    } catch (err: unknown) {
      setOauthError(err instanceof Error ? err.message : 'GitHub login could not be started');
    }
  };

  const handleKeycloakLogin = () => {
    setOauthError(null);
    keycloakStart();
  };

  // ── Passkey helpers ────────────────────────────────────────────────────────

  const buildRequestOptions = (startResp: Awaited<ReturnType<typeof webauthnAuthStart>>): PublicKeyCredentialRequestOptions => ({
    challenge: base64urlToBuffer(startResp.challenge),
    allowCredentials: startResp.allowCredentials?.map((c) => ({
      type: 'public-key' as PublicKeyCredentialType,
      id: base64urlToBuffer(c.id),
    })),
    userVerification: startResp.userVerification as UserVerificationRequirement,
    timeout: startResp.timeout,
    rpId: window.location.hostname,
  });

  const handlePasskeyClick = async () => {
    setPasskeyError(null);
    setPasskeyLoading(true);
    try {
      const startResp = await webauthnAuthStart();
      const options = buildRequestOptions(startResp);
      const cred = await navigator.credentials.get({ publicKey: options }) as PublicKeyCredential | null;
      if (!cred) throw new Error('No credential returned');
      const authResp = await webauthnAuthFinish(startResp.sessionId, cred);
      authLogin(authResp.userId, authResp.username, authResp.avatarUrl, authResp.isAdmin);
      await enterDefaultSession(authResp.userId, navigate, setMaps, setCurrentMap);
    } catch (err: unknown) {
      // NotAllowedError = user cancelled or no discoverable credential → show modal
      const name = err instanceof DOMException ? err.name : '';
      if (name !== 'NotAllowedError') {
        const isHttpError = err instanceof Error && err.message.startsWith('HTTP');
        if (!isHttpError) {
          // Likely no credentials available – show modal instead of error
        } else {
          setPasskeyError(err instanceof Error ? err.message : 'Passkey login failed');
          setPasskeyLoading(false);
          return;
        }
      }
      setShowPasskeyModal(true);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleRegister = async () => {
    const username = passkeyUsername.trim();
    if (!username) return;
    setPasskeyLoading(true);
    setPasskeyError(null);
    try {
      const startResp = await webauthnRegisterStart(username);
      const options: PublicKeyCredentialCreationOptions = {
        challenge: base64urlToBuffer(startResp.challenge),
        rp: startResp.rp,
        user: {
          id: new TextEncoder().encode(startResp.user.id),
          name: startResp.user.name,
          displayName: startResp.user.displayName,
        },
        pubKeyCredParams: startResp.pubKeyCredParams as PublicKeyCredentialParameters[],
        authenticatorSelection: {
          userVerification: startResp.authenticatorSelection.userVerification as UserVerificationRequirement,
          residentKey: startResp.authenticatorSelection.residentKey as ResidentKeyRequirement,
        },
        timeout: startResp.timeout,
      };
      const cred = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential | null;
      if (!cred) throw new Error('No credential created');
      const authResp = await webauthnRegisterFinish(startResp.sessionId, cred);
      authLogin(authResp.userId, authResp.username, authResp.avatarUrl, authResp.isAdmin);
      await enterDefaultSession(authResp.userId, navigate, setMaps, setCurrentMap);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPasskeyError(null);
      } else {
        setPasskeyError(err instanceof Error ? err.message : 'Registration failed');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSignInWithUsername = async () => {
    const username = passkeyUsername.trim();
    if (!username) return;
    setPasskeyLoading(true);
    setPasskeyError(null);
    try {
      const startResp = await webauthnAuthStart(username);
      const options = buildRequestOptions(startResp);
      const cred = await navigator.credentials.get({ publicKey: options }) as PublicKeyCredential | null;
      if (!cred) throw new Error('No credential returned');
      const authResp = await webauthnAuthFinish(startResp.sessionId, cred);
      authLogin(authResp.userId, authResp.username, authResp.avatarUrl, authResp.isAdmin);
      await enterDefaultSession(authResp.userId, navigate, setMaps, setCurrentMap);
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === 'NotAllowedError')) {
        setPasskeyError(err instanceof Error ? err.message : 'Sign-in failed');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  if (sessionLoading && !sessionResolved) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-muted-foreground text-sm">
        Checking session…
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-background">
      {/* Passkey modal */}
      {showPasskeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative flex flex-col gap-4 bg-card border border-border shadow-lg rounded-lg w-full max-w-sm mx-4 p-6">
            <button
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={() => { setShowPasskeyModal(false); setPasskeyError(null); }}
              aria-label="Close"
            >
              ✕
            </button>
            <div>
              <h2 className="text-base font-semibold text-foreground tron-logo">Passkey</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Create a new passkey or verify your username after signing in</p>
            </div>
            <input
              type="text"
              placeholder="Username"
              value={passkeyUsername}
              onChange={(e) => setPasskeyUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              className="w-full rounded border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            {passkeyError && (
              <p className="text-sm text-destructive">{passkeyError}</p>
            )}
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={handleRegister}
                disabled={passkeyLoading || !passkeyUsername.trim()}
                className="w-full gap-1.5 uppercase tracking-widest text-sm"
              >
                🔑 Register new Passkey
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={handleSignInWithUsername}
                disabled={passkeyLoading || !passkeyUsername.trim()}
                className="w-full gap-1.5 uppercase tracking-widest text-sm"
              >
                Sign in and verify username
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-8 p-6 sm:p-10 bg-card border border-border shadow-lg rounded-lg w-full max-w-sm mx-4 sm:mx-0">
        {/* Tron hexagonal emblem */}
        <div className="flex flex-col items-center gap-4">
          <img
            src="/logo.svg"
            alt="Tron hexagonal emblem"
            width={72}
            height={72}
          />
          <div className="flex flex-col items-center gap-1">
            <h1 className="tron-logo text-2xl">Porthole</h1>
            <p className="text-sm tracking-widest uppercase text-center leading-relaxed text-muted-foreground">
              <strong>{tagline}</strong>
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-border" />

        <div className="flex flex-col w-full gap-3">
          {githubEnabled && (
            <Button
              onClick={handleGitHubLogin}
              className="w-full gap-2 uppercase tracking-widest text-sm h-11"
              size="lg"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Access via GitHub
            </Button>
          )}

          {keycloakEnabled && (
            <Button
              onClick={handleKeycloakLogin}
              className="w-full gap-2 uppercase tracking-widest text-sm h-11"
              size="lg"
            >
              🔐 Access via Keycloak
            </Button>
          )}

          {webAuthnSupported && (
            <Button
              onClick={handlePasskeyClick}
              disabled={passkeyLoading}
              className="w-full gap-2 uppercase tracking-widest text-sm h-11"
              size="lg"
            >
              🔑 Sign in with Passkey
            </Button>
          )}
          {oauthError && (
            <p className="text-sm text-destructive text-center">{oauthError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
