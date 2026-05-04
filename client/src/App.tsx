import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { LOADING_COPY } from '@/components/ui/loadingCopy';
import { getSession } from './api/mapApi';
import { useAuthStore } from './store/mapStore';
import './App.css';

const AuthPage = lazy(() => import('./pages/AuthPage/AuthPage'));
const GitHubCallbackPage = lazy(() => import('./pages/AuthPage/GitHubCallbackPage'));
const KeycloakCallbackPage = lazy(() => import('./pages/AuthPage/KeycloakCallbackPage'));
const LobbyPage = lazy(() => import('./pages/LobbyPage/LobbyPage'));
const MapPage = lazy(() => import('./pages/MapPage/MapPage'));

function App() {
  const setSession = useAuthStore((s) => s.setSession);
  const setSessionLoading = useAuthStore((s) => s.setSessionLoading);

  useEffect(() => {
    let active = true;
    setSessionLoading(true);
    getSession()
      .then((session) => {
        if (active) setSession(session);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setSession, setSessionLoading]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<LoadingOverlay label={LOADING_COPY.view} variant="fullscreen" />}>
          <Routes>
            <Route path="/" element={<AuthPage />} />
            <Route path="/auth/github/callback" element={<GitHubCallbackPage />} />
            <Route path="/auth/keycloak/callback" element={<KeycloakCallbackPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/lobby" element={<LobbyPage />} />
              <Route path="/map/:id" element={<MapPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
