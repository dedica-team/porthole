import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage/AuthPage';
import GitHubCallbackPage from './pages/AuthPage/GitHubCallbackPage';
import KeycloakCallbackPage from './pages/AuthPage/KeycloakCallbackPage';
import LobbyPage from './pages/LobbyPage/LobbyPage';
import MapPage from './pages/MapPage/MapPage';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { getSession } from './api/mapApi';
import { useAuthStore } from './store/mapStore';
import './App.css';

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
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
