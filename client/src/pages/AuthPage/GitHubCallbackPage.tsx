import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { githubCallback } from '@/api/mapApi';
import { useAuthStore } from '@/store/mapStore';

export default function GitHubCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authLogin = useAuthStore((s) => s.login);
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
        navigate('/lobby', { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Login failed.');
      });
  }, [validationError, code, state, authLogin, navigate]);

  const tronEmblem = (
    <img
      src="/logo.svg"
      alt="Porthole logo"
      width={72}
      height={72}
      style={{ filter: 'drop-shadow(0 0 12px hsl(185,100%,54%))' }}
    />
  );

  if (validationError || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,240,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        <div className="flex flex-col items-center gap-6 p-8 bg-card border w-full max-w-sm"
          style={{
            boxShadow: '0 0 40px rgba(0,240,255,0.15), inset 0 0 0 1px rgba(0,240,255,0.07)',
            borderColor: 'hsl(185,100%,22%)',
          }}
        >
          {tronEmblem}
          <div className="flex flex-col items-center gap-1">
            <h1 className="tron-logo text-2xl">Porthole</h1>
            <p className="text-sm tracking-widest uppercase text-center leading-relaxed" style={{ color: 'hsl(185,60%,38%)' }}>
              Logging in...
            </p>
          </div>
          <p className="text-sm text-destructive text-center">{validationError ?? error}</p>
          <a
            href="/"
            className="inline-flex items-center justify-center h-11 px-4 w-full text-center uppercase tracking-widest text-sm"
            style={{
              background: 'transparent',
              border: '1px solid hsl(185,100%,54%)',
              color: 'hsl(185,100%,54%)',
              boxShadow: '0 0 10px rgba(0,240,255,0.3), inset 0 0 10px rgba(0,240,255,0.06)',
            }}
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-background"
      style={{
        backgroundImage:
          'linear-gradient(rgba(0,240,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      <div className="flex flex-col items-center gap-6 p-8 bg-card border w-full max-w-sm"
        style={{
          boxShadow: '0 0 40px rgba(0,240,255,0.15), inset 0 0 0 1px rgba(0,240,255,0.07)',
          borderColor: 'hsl(185,100%,22%)',
        }}
      >
        {tronEmblem}
        <div className="flex flex-col items-center gap-1">
          <h1 className="tron-logo text-2xl">Porthole</h1>
          <p className="text-sm tracking-widest uppercase text-center leading-relaxed" style={{ color: 'hsl(185,60%,38%)' }}>
            Logging in...
          </p>
        </div>
        <p className="text-sm text-center" style={{ color: 'hsl(185,60%,55%)' }}>Signing in with GitHub…</p>
      </div>
    </div>
  );
}
