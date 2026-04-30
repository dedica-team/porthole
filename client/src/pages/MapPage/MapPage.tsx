import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import {
  getMap,
  fetchProcesses,
} from '@/api/mapApi';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import { useMapWebSocket } from '@/hooks/useMapWebSocket';
import AppShell from '@/components/AppShell/AppShell';
import Sidebar from '@/components/Sidebar/Sidebar';
import MetricsView from '@/components/MetricsView/MetricsView';
import CollaboratorMatrixView from '@/components/CollaboratorMatrixView/CollaboratorMatrixView';
import RegularMapView from './RegularMapView';
import ProcessMapView from './ProcessMapView';
import ChoreListsView from '@/components/ChoreListsView/ChoreListsView';
import { useMapPageActions } from './useMapPageActions';

export default function MapPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    currentMap, setCurrentMap,
    mainView,
    processMode,
    processes, setProcesses, setProcessesFetched, setProcessesLoading,
  } = useMapStore(useShallow((s) => ({
    currentMap: s.currentMap, setCurrentMap: s.setCurrentMap,
    mainView: s.mainView,
    processMode: s.processMode,
    processes: s.processes,
    setProcesses: s.setProcesses, setProcessesFetched: s.setProcessesFetched,
    setProcessesLoading: s.setProcessesLoading,
  })));

  const userId = useAuthStore((s) => s.userId);
  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  const [initialLoading, setInitialLoading] = useState(true);

  // All shared CRUD handlers + actionLoading/error state
  const actions = useMapPageActions();
  const { cancelConnecting } = actions;

  useMapWebSocket(id);

  // ── Initial map load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setInitialLoading(true);
    getMap(id)
      .then((map) => setCurrentMap(map))
      .catch(() => navigate('/lobby'))
      .finally(() => setInitialLoading(false));
  }, [id, setCurrentMap, navigate]);

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
  const editorMode = useMapStore((s) => s.editorMode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelConnecting();
        setConfirmPending(false);
        if (!editorMode) {
          setSelectedLandmark(null);
          setSelectedTile(null);
          setMainView('idle');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelConnecting, setConfirmPending, editorMode, setSelectedLandmark, setSelectedTile, setMainView]);

  if (!currentMap || initialLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading session…
      </div>
    );
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
    <AppShell sidebar={mainView !== 'metrics' && mainView !== 'matrix' && mainView !== 'chores' ? sidebar : undefined}>
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
      ) : processMode ? (
        <ProcessMapView actions={actions} />
      ) : (
        <RegularMapView actions={actions} />
      )}
    </AppShell>
  );
}
