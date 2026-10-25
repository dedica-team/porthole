import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { githubCallback } from '@/api/mapApi';
import { useAuthStore, useMapStore } from '@/store/mapStore';
import { enterDefaultSession } from '@/utils/enterDefaultSession';

export default function GitHubCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authLogin = useAuthStore((s) => s.login);
  const setMaps = useMapStore((s) => s.setMaps);
  const setCurrentMap = useMapStore((s) => s.setCurrentMap);
  const called = useRef(false);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const validationError = !code
    ? 'Missing OAuth code from GitHub.'
    : !state
      ? 'Missing OAuth state from GitHub. Please try again.'
      : null;

  useEffect(() => {
    if (called.current || validationError || !code || !state) return;
    called.current = true;

    githubCallback(code, state)
      .then((resp) => {
        authLogin(resp.userId, resp.username, resp.avatarUrl);
        return enterDefaultSession(resp.userId, navigate, setMaps, setCurrentMap);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Login failed.');
      });
  }, [validationError, code, state, authLogin, navigate, setMaps, setCurrentMap]);

  const tronEmblem = (
    <img
      src="/logo.svg"
      alt="Porthole logo"
      width={72}
      height={72}
    />
  );

  if (validationError || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 p-8 bg-card border border-border shadow-lg rounded-lg w-full max-w-sm">
          {tronEmblem}
          <div className="flex flex-col items-center gap-1">
            <h1 className="tron-logo text-2xl">Porthole</h1>
            <p className="text-sm tracking-widest uppercase text-center leading-relaxed text-muted-foreground">
              Logging in...
            </p>
          </div>
          <p className="text-sm text-destructive text-center">{validationError ?? error}</p>
          <a
            href="/"
            className="inline-flex items-center justify-center h-11 px-4 w-full text-center uppercase tracking-widest text-sm rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 p-8 bg-card border border-border shadow-lg rounded-lg w-full max-w-sm">
        {tronEmblem}
        <div className="flex flex-col items-center gap-1">
          <h1 className="tron-logo text-2xl">Porthole</h1>
          <p className="text-sm tracking-widest uppercase text-center leading-relaxed text-muted-foreground">
            Logging in...
          </p>
        </div>
        <p className="text-sm text-center text-muted-foreground">Signing in with GitHub…</p>
      </div>
    </div>
  );
}
