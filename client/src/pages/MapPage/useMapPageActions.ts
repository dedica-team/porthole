/**
 * useMapPageActions
 *
 * Centralises all withAction-wrapped CRUD callbacks that are shared between
 * RegularMapView, ProcessMapView, and the Sidebar/MetricsView/MatrixView.
 * Reads currentMap and store updaters directly so callers need zero prop-drilling.
 */
import { useState, useCallback, useMemo } from 'react';
import type React from 'react';
import { useMapStore } from '@/store/mapStore';
import {
  placeLandmark,
  createUnpositionedLandmark,
  positionLandmark,
  createConnection,
  editConnection,
  editTile,
  removeConnection,
  editLandmark,
  removeLandmark,
  createGroup,
  editGroup,
  removeGroup,
  createMetric,
  editMetric,
  removeMetric,
  setLandmarkMetric,
  clearLandmarkMetric,
  editCollaboratorMatrix,
  setMatrixEntry,
  clearMatrixEntry,
} from '@/api/mapApi';
import type { SessionState } from '@/types/session';
import type { Landmark, LandmarkType, QualityLevel, QualityMetric } from '@/types/landmark';
import type { ConnectionType } from '@/types/connection';
import type { MatrixLevel, CollaboratorMatrix } from '@/types/matrix';
import type { ChoreList } from '@/types/chores';
import type { Terrain } from '@/types/hex';
export function useMapPageActions() {
  const currentMap  = useMapStore((s) => s.currentMap);
  const updateMap   = useMapStore((s) => s.updateMap);
  const setMetrics  = useMapStore((s) => s.setMetrics);
  const setCollaboratorMatrix = useMapStore((s) => s.setCollaboratorMatrix);
  const setChoreLists = useMapStore((s) => s.setChoreLists);
  const selectedLandmark   = useMapStore((s) => s.selectedLandmark);
  const setSelectedLandmark = useMapStore((s) => s.setSelectedLandmark);
  const setSelectedTile    = useMapStore((s) => s.setSelectedTile);
  const setMainView        = useMapStore((s) => s.setMainView);
  const setConnectingFromLandmark = useMapStore((s) => s.setConnectingFromLandmark);
  const setRelocatingLandmark     = useMapStore((s) => s.setRelocatingLandmark);
  const setPendingConnectionMeta  = useMapStore((s) => s.setPendingConnectionMeta);
  const commitTile  = useMapStore((s) => s.commitTile);
  const revertTile  = useMapStore((s) => s.revertTile);

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const withAction = useCallback(async (fn: () => Promise<SessionState>) => {
    setActionLoading(true);
    setError('');
    try {
      const updated = await fn();
      // The server returns the full MapState which still contains metrics,
      // collaboratorMatrix and choreLists. Hydrate the dedicated store slices
      // whenever the response carries them so views stay in sync.
      const raw = updated as typeof updated & {
        metrics?: Record<string, QualityMetric>;
        collaboratorMatrix?: CollaboratorMatrix;
        choreLists?: Record<string, ChoreList>;
      };
      if (raw.metrics)            setMetrics(raw.metrics);
      if (raw.collaboratorMatrix) setCollaboratorMatrix(raw.collaboratorMatrix);
      if (raw.choreLists)         setChoreLists(Object.values(raw.choreLists));
      updateMap(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }, [updateMap, setMetrics, setCollaboratorMatrix, setChoreLists]);

  const cancelConnecting = useCallback(() => {
    setConnectingFromLandmark(null);
    setRelocatingLandmark(null);
    setSelectedTile(null);
  }, [setConnectingFromLandmark, setRelocatingLandmark, setSelectedTile]);

  // ── Lookup memos ─────────────────────────────────────────────────────────────

  const landmarkByCoord = useMemo(() => {
    const m = new Map<string, Landmark>();
    Object.values(currentMap?.landmarks ?? {}).forEach((l) => {
      if (!l.coordinate) return;
      m.set(`${l.coordinate.q},${l.coordinate.r}`, l);
    });
    return m;
  }, [currentMap?.landmarks]);

  const tileByCoord = useMemo(() => {
    const m = new Map<string, NonNullable<typeof currentMap>['map']['tiles'][number]>();
    (currentMap?.map?.tiles ?? []).forEach((t) => m.set(`${t.coordinate.q},${t.coordinate.r}`, t));
    return m;
  }, [currentMap?.map?.tiles]);

  const positionedLandmarks = useMemo(
    () => Object.values(currentMap?.landmarks ?? {}).filter((l) => l.coordinate != null),
    [currentMap?.landmarks],
  );

  // ── Tile editing (shared because fireEditTile is also used by RegularMapView) ─

  const fireEditTile = useCallback((
    q: number, r: number,
    elevation: number | undefined,
    terrain: Terrain | undefined,
    patchRef: React.RefObject<((q: number, r: number, terrain: Terrain, elevation: number) => void) | null>,
  ) => {
    if (!currentMap) return;
    const tile = tileByCoord.get(`${q},${r}`);
    if (!tile) return;
    const newElevation = elevation ?? tile.elevation;
    const newTerrain: Terrain = terrain ?? tile.terrain;
    patchRef.current?.(q, r, newTerrain, newElevation);
    editTile(currentMap.id, q, r, elevation, terrain)
      .then(() => commitTile(currentMap.id, q, r))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Edit failed');
        revertTile(currentMap.id, tile);
        patchRef.current?.(q, r, tile.terrain, tile.elevation);
      });
  }, [currentMap, tileByCoord, commitTile, revertTile]);

  // ── Landmark handlers ────────────────────────────────────────────────────────

  const handlePlaceLandmark = useCallback((q: number, r: number, name: string, type: LandmarkType) => {
    withAction(() => placeLandmark(currentMap!.id, q, r, name, type));
  }, [currentMap, withAction]);

  const handleCreateUnpositionedLandmark = useCallback((
    name: string, type: LandmarkType, description?: string, groupId?: string, link?: string,
  ) => {
    withAction(() => createUnpositionedLandmark(currentMap!.id, name, type, description, groupId, link));
  }, [currentMap, withAction]);

  const handlePositionLandmark = useCallback((landmarkId: string, q: number, r: number) => {
    withAction(() => positionLandmark(currentMap!.id, landmarkId, q, r));
  }, [currentMap, withAction]);

  const handleRemoveLandmark = useCallback(() => {
    if (!selectedLandmark) return;
    const landmarkId = selectedLandmark.id;
    withAction(() => removeLandmark(currentMap!.id, landmarkId));
    setSelectedLandmark(null);
    setSelectedTile(null);
    setMainView('idle');
  }, [selectedLandmark, currentMap, withAction, setSelectedLandmark, setSelectedTile, setMainView]);

  const handleEditLandmark = useCallback((
    landmarkId: string, name?: string, type?: LandmarkType, description?: string,
    groupId?: string, clearGroup?: boolean, link?: string, clearLink?: boolean,
  ) => {
    withAction(() => editLandmark(currentMap!.id, landmarkId, name, type, description, groupId, clearGroup, link, clearLink));
  }, [currentMap, withAction]);

  const handleEditLandmarkGroup = useCallback((landmarkId: string, groupId: string | null) => {
    withAction(() => editLandmark(currentMap!.id, landmarkId, undefined, undefined, undefined,
      groupId ?? undefined, groupId === null, undefined, undefined));
  }, [currentMap, withAction]);

  // ── Connection handlers ──────────────────────────────────────────────────────

  const handleStartConnection = useCallback((type: ConnectionType, name?: string, description?: string) => {
    if (!selectedLandmark) return;
    setConnectingFromLandmark(selectedLandmark.id);
    setPendingConnectionMeta({ type, name, description });
    setSelectedLandmark(null);
    setMainView('idle');
  }, [selectedLandmark, setConnectingFromLandmark, setPendingConnectionMeta, setSelectedLandmark, setMainView]);

  const handleEditConnection = useCallback((
    connectionId: string, type?: ConnectionType, name?: string, description?: string,
    clearName?: boolean, clearDescription?: boolean,
  ) => {
    withAction(() => editConnection(currentMap!.id, connectionId, type, name, description, clearName, clearDescription));
  }, [currentMap, withAction]);

  const handleRemoveConnection = useCallback((connectionId: string) => {
    withAction(() => removeConnection(currentMap!.id, connectionId));
  }, [currentMap, withAction]);

  const handleCreateConnection = useCallback((
    originId: string, targetId: string, type: ConnectionType, name?: string, description?: string,
  ) => {
    withAction(() => createConnection(currentMap!.id, originId, targetId, type, name, description));
  }, [currentMap, withAction]);

  // ── Group handlers ───────────────────────────────────────────────────────────

  const handleCreateGroup = useCallback((name: string, color: string, description?: string, link?: string) => {
    withAction(() => createGroup(currentMap!.id, name, color, description, link));
  }, [currentMap, withAction]);

  const handleEditGroup = useCallback((
    groupId: string, name?: string, color?: string, description?: string,
    clearDescription?: boolean, link?: string, clearLink?: boolean,
  ) => {
    withAction(() => editGroup(currentMap!.id, groupId, name, color, description, clearDescription, link, clearLink));
  }, [currentMap, withAction]);

  const handleRemoveGroup = useCallback((groupId: string) => {
    withAction(() => removeGroup(currentMap!.id, groupId));
  }, [currentMap, withAction]);

  // ── Metric handlers ──────────────────────────────────────────────────────────

  const handleCreateMetric = useCallback((name: string, description: string) => {
    withAction(() => createMetric(currentMap!.id, name, description));
  }, [currentMap, withAction]);

  const handleEditMetric = useCallback((metricId: string, name?: string, description?: string) => {
    withAction(() => editMetric(currentMap!.id, metricId, name, description));
  }, [currentMap, withAction]);

  const handleRemoveMetric = useCallback((metricId: string) => {
    withAction(() => removeMetric(currentMap!.id, metricId));
  }, [currentMap, withAction]);

  const handleSetLandmarkMetric = useCallback((
    landmarkId: string, metricId: string, value: string | undefined,
    level: QualityLevel, link?: string, badges?: Record<string, string>,
  ) => {
    withAction(() => setLandmarkMetric(currentMap!.id, landmarkId, metricId, value, level, link, badges));
  }, [currentMap, withAction]);

  const handleClearLandmarkMetric = useCallback((landmarkId: string, metricId: string) => {
    withAction(() => clearLandmarkMetric(currentMap!.id, landmarkId, metricId));
  }, [currentMap, withAction]);

  // ── Matrix handlers ──────────────────────────────────────────────────────────

  const handleEditCollaboratorMatrix = useCallback((name: string) => {
    withAction(() => editCollaboratorMatrix(currentMap!.id, name));
  }, [currentMap, withAction]);

  const handleSetMatrixEntry = useCallback((landmarkId: string, collaboratorId: string, level: MatrixLevel) => {
    withAction(() => setMatrixEntry(currentMap!.id, landmarkId, collaboratorId, level));
  }, [currentMap, withAction]);

  const handleClearMatrixEntry = useCallback((landmarkId: string, collaboratorId: string) => {
    withAction(() => clearMatrixEntry(currentMap!.id, landmarkId, collaboratorId));
  }, [currentMap, withAction]);

  return {
    // State
    actionLoading,
    error,
    setError,
    // Core helpers
    withAction,
    cancelConnecting,
    fireEditTile,
    // Memos
    landmarkByCoord,
    tileByCoord,
    positionedLandmarks,
    // Landmark
    handlePlaceLandmark,
    handleCreateUnpositionedLandmark,
    handlePositionLandmark,
    handleRemoveLandmark,
    handleEditLandmark,
    handleEditLandmarkGroup,
    // Connection
    handleStartConnection,
    handleEditConnection,
    handleRemoveConnection,
    handleCreateConnection,
    // Group
    handleCreateGroup,
    handleEditGroup,
    handleRemoveGroup,
    // Metric
    handleCreateMetric,
    handleEditMetric,
    handleRemoveMetric,
    handleSetLandmarkMetric,
    handleClearLandmarkMetric,
    // Matrix
    handleEditCollaboratorMatrix,
    handleSetMatrixEntry,
    handleClearMatrixEntry,
  };
}

