import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession } from '@/api/mapApi';
import { useAuthStore, useMapStore } from '@/store/mapStore';
import { enterDefaultSession } from '@/utils/enterDefaultSession';

/**
 * Landing page after Spring OAuth2 redirects back from Keycloak.
 * The porthole JWT cookie is already set by KeycloakLoginSuccessHandler.
 * We just need to load the session and enter the user's default session.
 */
export default function KeycloakCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const authLogin = useAuthStore((s) => s.login);
  const setMaps = useMapStore((s) => s.setMaps);
  const setCurrentMap = useMapStore((s) => s.setCurrentMap);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    getSession()
      .then((resp) => {
        authLogin(resp.userId, resp.username, resp.avatarUrl, resp.isAdmin);
        return enterDefaultSession(resp.userId, navigate, setMaps, setCurrentMap);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Login failed.');
      });
  }, [authLogin, navigate, setMaps, setCurrentMap]);

  const tronEmblem = (
    <img
      src="/logo.svg"
      alt="Porthole logo"
      width={72}
      height={72}
    />
  );

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 p-8 bg-card border border-border shadow-lg rounded-lg w-full max-w-sm">
          {tronEmblem}
          <h1 className="tron-logo text-2xl">Porthole</h1>
          <p className="text-sm text-destructive text-center">{error}</p>
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
        <h1 className="tron-logo text-2xl">Porthole</h1>
        <p className="text-sm text-center text-muted-foreground">
          Signing in with Keycloak…
        </p>
      </div>
    </div>
  );
}
