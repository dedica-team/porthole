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
const RegularMapView = lazy(() => import('./pages/MapPage/RegularMapView'));
const ProcessMapView = lazy(() => import('./pages/MapPage/ProcessMapView'));
const ProcessDesignView = lazy(() => import('./pages/ProcessDesign/ProcessDesignView'));
const MetricsView = lazy(() => import('./components/MetricsView/MetricsView'));
const MetricPushView = lazy(() => import('./components/MetricsView/MetricPushView'));
const CollaboratorMatrixView = lazy(() => import('./components/CollaboratorMatrixView/CollaboratorMatrixView'));
const ChoreListsView = lazy(() => import('./components/ChoreListsView/ChoreListsView'));
const GreenkeepingRotationsView = lazy(() => import('./components/GreenkeepingRotationsView/GreenkeepingRotationsView'));
const GreenkeepingChecklistView = lazy(() => import('./components/GreenkeepingRotationsView/GreenkeepingChecklistView'));
const EditorMapView = lazy(() => import('./pages/MapPage/EditorMapView'));
const SessionOverviewView = lazy(() => import('./pages/MapPage/SessionOverviewView'));

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
              <Route path="/session/:id" element={<MapPage />}>
                <Route index element={<SessionOverviewView />} />
                <Route path="map" element={<RegularMapView />} />
                <Route path="processes" element={<ProcessMapView />} />
                <Route path="process-design" element={<ProcessDesignView />} />
                <Route path="process-design/:processId" element={<ProcessDesignView />} />
                <Route path="editor" element={<EditorMapView />} />
                <Route path="metrics" element={<MetricsView />} />
                <Route path="metrics/push" element={<MetricPushView />} />
                <Route path="metrics/:metricId/push" element={<MetricPushView />} />
                <Route path="matrix" element={<CollaboratorMatrixView />} />
                <Route path="chores" element={<ChoreListsView />} />
                <Route path="greenkeeping" element={<GreenkeepingRotationsView />} />
                <Route path="greenkeeping/:rotationId" element={<GreenkeepingChecklistView />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
