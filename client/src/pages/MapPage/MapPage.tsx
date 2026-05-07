import { Suspense, lazy, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { fetchProcesses } from '@/api/mapApi';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import { useSessionWebSocket } from '@/hooks/useSessionWebSocket';
import AppShell from '@/components/AppShell/AppShell';
import Sidebar from '@/components/Sidebar/Sidebar';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { LOADING_COPY } from '@/components/ui/loadingCopy';
import { useMapPageActions } from './useMapPageActions';

const MetricsView = lazy(() => import('@/components/MetricsView/MetricsView'));
const CollaboratorMatrixView = lazy(() => import('@/components/CollaboratorMatrixView/CollaboratorMatrixView'));
const RegularMapView = lazy(() => import('./RegularMapView'));
const ProcessMapView = lazy(() => import('./ProcessMapView'));
const ChoreListsView = lazy(() => import('@/components/ChoreListsView/ChoreListsView'));
const GreenkeepingRotationsView = lazy(() => import('@/components/GreenkeepingRotationsView/GreenkeepingRotationsView'));

export default function MapPage() {
  const { id } = useParams<{ id: string }>();

  const {
    currentMap,
    mainView,
    pendingView,
    processMode,
    processes, setProcesses, setProcessesFetched, setProcessesLoading, setPendingView,
  } = useMapStore(useShallow((s) => ({
    currentMap: s.currentMap,
    mainView: s.mainView,
    pendingView: s.pendingView,
    processMode: s.processMode,
    processes: s.processes,
    setProcesses: s.setProcesses, setProcessesFetched: s.setProcessesFetched,
    setProcessesLoading: s.setProcessesLoading,
    setPendingView: s.setPendingView,
  })));

  const userId = useAuthStore((s) => s.userId);
  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  // All shared CRUD handlers + actionLoading/error state
  const actions = useMapPageActions();
  const { cancelConnecting } = actions;

  // WS hook: connects, subscribes to all topics and seeds all store slices on connect
  useSessionWebSocket(id);

  // ── Viewer: eagerly fetch processes so arrows are visible ─────────────────
  useEffect(() => {
    if (!currentMap || isCollaborator) return;
    setProcessesLoading(true);
    fetchProcesses(currentMap.id)
      .then((data) => { setProcesses(data); setProcessesFetched(true); })
      .catch(() => { /* arrows simply won't show */ })
      .finally(() => setProcessesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMap?.id, isCollaborator]);

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
        if (mainView !== 'editor') {
          setSelectedLandmark(null);
          setSelectedTile(null);
          setMainView('idle');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelConnecting, setConfirmPending, mainView, setSelectedLandmark, setSelectedTile, setMainView]);

  useEffect(() => {
    if (!pendingView) return;
    const frameId = window.requestAnimationFrame(() => setPendingView(null));
    return () => window.cancelAnimationFrame(frameId);
  }, [pendingView, setPendingView]);

  if (!currentMap) {
    return <LoadingOverlay label={LOADING_COPY.session} />;
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

  const fallbackLabel = pendingView === 'idle' || pendingView === 'editor' || pendingView === 'process'
    ? LOADING_COPY.map
    : processMode
      ? LOADING_COPY.map
      : LOADING_COPY.view;

  return (
    <AppShell sidebar={pendingView ? undefined : mainView !== 'metrics' && mainView !== 'matrix' && mainView !== 'chores' && mainView !== 'greenkeeping' ? sidebar : undefined}>
      {pendingView ? (
        <LoadingOverlay label={fallbackLabel} />
      ) : (
      <Suspense fallback={<LoadingOverlay label={processMode ? LOADING_COPY.map : LOADING_COPY.view} />}>
        {mainView === 'metrics' ? (
          <MetricsView
            onCreateMetric={actions.handleCreateMetric}
            onCreateUnpositionedLandmark={actions.handleCreateUnpositionedLandmark}
            onEditMetric={actions.handleEditMetric}
            onRemoveMetric={actions.handleRemoveMetric}
            onSetLandmarkMetric={actions.handleSetLandmarkMetric}
            onClearLandmarkMetric={actions.handleClearLandmarkMetric}
            onEditLandmarkGroup={actions.handleEditLandmarkGroup}
            onEditLandmark={actions.handleEditLandmark}
            onCreateGroup={actions.handleCreateGroup}
            onEditGroup={actions.handleEditGroup}
            onRemoveGroup={actions.handleRemoveGroup}
            loading={actions.actionLoading}
            error={actions.error}
            onClearError={() => actions.setError('')}
          />
        ) : mainView === 'matrix' ? (
          <CollaboratorMatrixView
            onEditMatrix={actions.handleEditCollaboratorMatrix}
            onSetEntry={actions.handleSetMatrixEntry}
            onClearEntry={actions.handleClearMatrixEntry}
            onEditLandmark={actions.handleEditLandmark}
            loading={actions.actionLoading}
            error={actions.error}
            onClearError={() => actions.setError('')}
          />
        ) : mainView === 'chores' ? (
          <ChoreListsView />
        ) : mainView === 'greenkeeping' ? (
          <GreenkeepingRotationsView />
        ) : processMode ? (
          <ProcessMapView actions={actions} />
        ) : (
          <RegularMapView actions={actions} />
        )}
      </Suspense>
      )}
    </AppShell>
  );
}
