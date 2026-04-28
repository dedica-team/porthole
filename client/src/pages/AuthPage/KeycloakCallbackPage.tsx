import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession } from '@/api/mapApi';
import { useAuthStore } from '@/store/mapStore';

/**
 * Landing page after Spring OAuth2 redirects back from Keycloak.
 * The porthole JWT cookie is already set by KeycloakLoginSuccessHandler.
 * We just need to load the session and navigate to the lobby.
 */
export default function KeycloakCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const authLogin = useAuthStore((s) => s.login);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    getSession()
      .then((resp) => {
        authLogin(resp.userId, resp.username, resp.avatarUrl, resp.isAdmin);
        navigate('/lobby', { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Login failed.');
      });
  }, [authLogin, navigate]);

  const tronEmblem = (
    <img
      src="/logo.svg"
      alt="Porthole logo"
      width={72}
      height={72}
      style={{ filter: 'drop-shadow(0 0 12px hsl(185,100%,54%))' }}
    />
  );
  const containerStyle = {
    backgroundImage:
      'linear-gradient(rgba(0,240,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.04) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
  };
  const cardStyle = {
    boxShadow: '0 0 40px rgba(0,240,255,0.15), inset 0 0 0 1px rgba(0,240,255,0.07)',
    borderColor: 'hsl(185,100%,22%)',
  };

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background" style={containerStyle}>
        <div className="flex flex-col items-center gap-6 p-8 bg-card border w-full max-w-sm" style={cardStyle}>
          {tronEmblem}
          <h1 className="tron-logo text-2xl">Porthole</h1>
          <p className="text-sm text-destructive text-center">{error}</p>
          <a
            href="/"
            className="inline-flex items-center justify-center h-11 px-4 w-full text-center uppercase tracking-widest text-xs"
            style={{
              background: 'transparent',
              border: '1px solid hsl(185,100%,54%)',
              color: 'hsl(185,100%,54%)',
            }}
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-background" style={containerStyle}>
      <div className="flex flex-col items-center gap-6 p-8 bg-card border w-full max-w-sm" style={cardStyle}>
        {tronEmblem}
        <h1 className="tron-logo text-2xl">Porthole</h1>
        <p className="text-sm text-center" style={{ color: 'hsl(185,60%,55%)' }}>
          Signing in with Keycloak…
        </p>
      </div>
    </div>
  );
}
