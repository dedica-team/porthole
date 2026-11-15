import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useParams, useMatch } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { fetchProcesses } from '@/api/mapApi';
import { useMapStore } from '@/store/mapStore';
import { useSessionWebSocket } from '@/hooks/useSessionWebSocket';
import AppShell from '@/components/AppShell/AppShell';
import Sidebar from '@/components/Sidebar/Sidebar';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { LOADING_COPY } from '@/components/ui/loadingCopy';
import { useMapPageActions } from './useMapPageActions';
import { MapActionsContext } from './MapActionsContext';


export default function MapPage() {
  const { id } = useParams<{ id: string }>();

  const {
    currentMap,
    pendingView,
    processes, setProcesses, setProcessesFetched,
  } = useMapStore(useShallow((s) => ({
    currentMap: s.currentMap,
    pendingView: s.pendingView,
    processes: s.processes,
    setProcesses: s.setProcesses,
    setProcessesFetched: s.setProcessesFetched,
  })));

  // All shared CRUD handlers + actionLoading/error state
  const actions = useMapPageActions();
  const { cancelConnecting } = actions;

  // WS hook: connects, subscribes to all topics and seeds all store slices on connect
  useSessionWebSocket(id);

  // ── Cascade refetch when a connection is removed ──────────────────────────
  const prevConnectionKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentMap) return;
    const currentKeys = new Set(Object.keys(currentMap.connections ?? {}));
    const prev = prevConnectionKeysRef.current;
    const removed = [...prev].some((k) => !currentKeys.has(k));
    prevConnectionKeysRef.current = currentKeys;
    if (removed && processes.length > 0) {
      fetchProcesses(currentMap.id)
        .then((data) => { setProcesses(data); setProcessesFetched(true); })
        .catch(() => { /* ignore */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMap?.connections]);

  // ── Global Escape handler ─────────────────────────────────────────────────
  const setConfirmPending = useMapStore((s) => s.setConfirmPending);
  const setSelectedLandmark = useMapStore((s) => s.setSelectedLandmark);
  const setSelectedTile = useMapStore((s) => s.setSelectedTile);
  const setMainView = useMapStore((s) => s.setMainView);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelConnecting();
        setConfirmPending(false);
        setSelectedLandmark(null);
        setSelectedTile(null);
        setMainView('idle');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelConnecting, setConfirmPending, setSelectedLandmark, setSelectedTile, setMainView]);

  // ── Sidebar visibility: hide on full-panel routes ─────────────────────────
  // useMatch must be called unconditionally so we call it for each panel route.
  const matchMetrics     = useMatch({ path: '/session/:id/metrics', end: false });
  const matchMatrix      = useMatch('/session/:id/matrix');
  const matchChores      = useMatch('/session/:id/chores');
  const matchGreenkeeping = useMatch({ path: '/session/:id/greenkeeping', end: false });
  const matchEditor      = useMatch('/session/:id/editor');
  const isPanelRoute = !!(matchMetrics || matchMatrix || matchChores || matchGreenkeeping || matchEditor);

  if (!currentMap) {
    return <LoadingOverlay label={LOADING_COPY.session} />;
  }

  // Show a loading overlay while a lazy route chunk is being fetched
  if (pendingView) {
    return <LoadingOverlay label={LOADING_COPY.view} />;
  }

  const sidebar = (
    <Sidebar
      onPlaceLandmark={actions.handlePlaceLandmark}
      onPositionLandmark={actions.handlePositionLandmark}
      onStartConnection={actions.handleStartConnection}
      onCancelConnection={cancelConnecting}
      onRemoveLandmark={actions.handleRemoveLandmark}
      onEditLandmark={actions.handleEditLandmark}
      onEditConnection={actions.handleEditConnection}
      onRemoveConnection={actions.handleRemoveConnection}
      onCreateMetric={actions.handleCreateMetric}
      onEditMetric={actions.handleEditMetric}
      onRemoveMetric={actions.handleRemoveMetric}
      onSetLandmarkMetric={actions.handleSetLandmarkMetric}
      onClearLandmarkMetric={actions.handleClearLandmarkMetric}
      loading={actions.actionLoading}
      error={actions.error}
      onClearError={() => actions.setError('')}
    />
  );

  return (
    <MapActionsContext.Provider value={actions}>
      <AppShell sidebar={isPanelRoute ? undefined : sidebar}>
        <Suspense fallback={<LoadingOverlay label={LOADING_COPY.view} />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </MapActionsContext.Provider>
  );
}
