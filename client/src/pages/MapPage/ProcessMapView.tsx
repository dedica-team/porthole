/**
 * ProcessMapView  (X-ray process view)
 *
 * Hides terrain decorations, highlights landmark rings and connection arrows
 * for the active process / stage.  Owns all process-specific memos,
 * connection-click handler, and the "New Connection" overlay.
 */
import { useRef, useCallback, useMemo, useState } from 'react';import { Plus, Layers, GitBranch } from 'lucide-react';import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import HexGrid from '@/components/HexGrid/HexGrid';
import MapInitOverlay from '@/components/HexGrid/MapInitOverlay';
import LandmarkSearchField from '@/components/LandmarkSearchField';
import CreateConnectionDialog from '@/components/CreateConnectionDialog';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import { useShallow } from 'zustand/react/shallow';
import { addConnectionToStage, removeConnectionFromStage, createProcess } from '@/api/mapApi';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Connection } from '@/types/connection';
import type { StageConnection } from '@/types/process';
import { QUALITY_LEVEL_COLOR, QUALITY_LEVEL_SIGN } from '@/types/landmark';
import type { useMapPageActions } from './useMapPageActions';

interface Props {
  actions: ReturnType<typeof useMapPageActions>;
}

export default function ProcessMapView({ actions }: Props) {
  const { positionedLandmarks, setError, landmarkByCoord } = actions;

  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const dismissOverlayRef = useRef<(() => void) | null>(null);

  const {
    currentMap, updateMap, metrics,
    setSelectedLandmark,
    setSelectedTile,
    setSelectedConnectionId,
    activeProcessId, activeStageId,
    processes, setProcesses,
    pickingConnection,
    setActiveProcessId,
    rendererQualityProfile,
  } = useMapStore(useShallow((s) => ({
    currentMap: s.currentMap,
    updateMap: s.updateMap,
    metrics: s.metrics,
    selectedLandmark: s.selectedLandmark, setSelectedLandmark: s.setSelectedLandmark,
    setSelectedTile: s.setSelectedTile,
    setSelectedConnectionId: s.setSelectedConnectionId,
    activeProcessId: s.activeProcessId, activeStageId: s.activeStageId,
    processes: s.processes, setProcesses: s.setProcesses,
    pickingConnection: s.pickingConnection,
    setActiveProcessId: s.setActiveProcessId,
    rendererQualityProfile: s.rendererQualityProfile,
  })));

  const userId = useAuthStore((s) => s.userId);
  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  const [createConnOpen, setCreateConnOpen] = useState(false);
  const [newProcPopoverOpen, setNewProcPopoverOpen] = useState(false);
  const [newProcName, setNewProcName] = useState('');
  const [newProcDesc, setNewProcDesc] = useState('');
  const [newProcSaving, setNewProcSaving] = useState(false);
  const [newProcError, setNewProcError] = useState('');
  const fpsRef = useRef<HTMLDivElement>(null);

  const handleCreateProcess = async () => {
    if (!currentMap || !newProcName.trim()) return;
    setNewProcSaving(true);
    setNewProcError('');
    try {
      const updated = await createProcess(currentMap.id, newProcName.trim(), newProcDesc.trim() || undefined);
      setProcesses(updated);
      const created = updated.find((p) => p.name === newProcName.trim());
      if (created) setActiveProcessId(created.id);
      setNewProcPopoverOpen(false);
      setNewProcName('');
      setNewProcDesc('');
    } catch (err: unknown) {
      setNewProcError(err instanceof Error ? err.message : 'Failed to create process');
    } finally {
      setNewProcSaving(false);
    }
  };

  // ── Process-specific memos ───────────────────────────────────────────────────

  /** All connection IDs across every stage of the active process (for dimming). */
  const activeProcessConnectionIds = useMemo<Set<string> | undefined>(() => {
    if (!activeProcessId) return undefined;
    const stages = processes.find((p) => p.id === activeProcessId)?.stages ?? [];
    const ids = new Set<string>();
    stages.forEach((s) => s.connections.forEach((sc) => ids.add(sc.connectionId)));
    return ids;
  }, [activeProcessId, processes]);

  /**
   * Connection IDs whose regular meshes should be hidden (replaced by arrows).
   * When a stage is open: only that stage's connections.
   * When no stage is open: all process connections.
   */
  const activeStageConnectionIds = useMemo<Set<string> | undefined>(() => {
    if (!activeProcessId) return undefined;
    const proc = processes.find((p) => p.id === activeProcessId);
    if (!proc) return undefined;
    if (activeStageId) {
      const stage = proc.stages.find((s) => s.id === activeStageId);
      if (!stage) return undefined;
      return new Set(stage.connections.map((sc) => sc.connectionId));
    }
    const ids = new Set<string>();
    proc.stages.forEach((s) => s.connections.forEach((sc) => ids.add(sc.connectionId)));
    return ids;
  }, [activeProcessId, activeStageId, processes]);

  /**
   * Resolved StageConnection + Connection pairs for the ProcessArrowRenderer.
   * No stage open → all stages combined (sorted by order, deduped by connectionId).
   */
  const processStageConnections = useMemo<Array<{ stageConn: StageConnection; connection: Connection }> | undefined>(() => {
    if (!activeProcessId || !currentMap) return undefined;
    const proc = processes.find((p) => p.id === activeProcessId);
    if (!proc) return undefined;
    if (activeStageId) {
      const stage = proc.stages.find((s) => s.id === activeStageId);
      if (!stage) return undefined;
      return stage.connections.flatMap((sc) => {
        const conn = currentMap.connections?.[sc.connectionId];
        return conn ? [{ stageConn: sc, connection: conn }] : [];
      });
    }
    const seen = new Set<string>();
    return proc.stages
      .slice()
      .sort((a, b) => a.order - b.order)
      .flatMap((s) => s.connections)
      .flatMap((sc) => {
        if (seen.has(sc.connectionId)) return [];
        seen.add(sc.connectionId);
        const conn = currentMap.connections?.[sc.connectionId];
        return conn ? [{ stageConn: sc, connection: conn }] : [];
      });
  }, [activeProcessId, activeStageId, processes, currentMap]);

  /** Per-tile colour (group colour or default cyan) for landmark highlight rings. */
  const landmarkHighlightColors = useMemo<Map<string, number> | undefined>(() => {
    if (!currentMap) return undefined;
    const result = new Map<string, number>();
    Object.values(currentMap.landmarks).forEach((lm) => {
      if (!lm.coordinate) return;
      const key = `${lm.coordinate.q},${lm.coordinate.r}`;
      const group = lm.groupId ? (currentMap.groups ?? {})[lm.groupId] : undefined;
      const color = group?.color ? parseInt(group.color.replace('#', ''), 16) : 0x38bdf8;
      result.set(key, color);
    });
    return result;
  }, [currentMap]);

  /**
   * Set of "q,r" tile keys for the active stage: landmark tiles + path tiles
   * of every connection in the open stage.
   * No stage open → all tiles of the active process (all stages).
   * No process active → undefined (no highlights).
   */
  const stageHighlightTiles = useMemo<Set<string> | undefined>(() => {
    if (!activeProcessId || !currentMap) return undefined;
    const proc = processes.find((p) => p.id === activeProcessId);
    if (!proc) return undefined;

    const stagesToHighlight = activeStageId
      ? proc.stages.filter((s) => s.id === activeStageId)
      : proc.stages;

    const keys = new Set<string>();
    for (const stage of stagesToHighlight) {
      for (const sc of stage.connections) {
        const conn = currentMap.connections?.[sc.connectionId];
        if (!conn) continue;
        for (const coord of (conn.path ?? [])) {
          keys.add(`${coord.q},${coord.r}`);
        }
        const origin = currentMap.landmarks[conn.originId];
        const target = currentMap.landmarks[conn.targetId];
        if (origin?.coordinate) keys.add(`${origin.coordinate.q},${origin.coordinate.r}`);
        if (target?.coordinate) keys.add(`${target.coordinate.q},${target.coordinate.r}`);
      }
    }
    return keys.size > 0 ? keys : undefined;
  }, [activeProcessId, activeStageId, processes, currentMap]);

  /**
   * Per-landmark metric values for the CSS2D overlay.
   * Only landmarks with a non-NONE entry for the selected metric are included.
   */
  const metricOverlayEntries = useMemo<Map<string, { value: string; color: string }> | undefined>(() => {
    if (!selectedMetricId || !currentMap) return undefined;
    const result = new Map<string, { value: string; color: string }>();
    Object.values(currentMap.landmarks).forEach((lm) => {
      if (!lm.coordinate) return;
      const entry = lm.metrics?.[selectedMetricId];
      if (!entry || entry.level === 'NONE') return;
      result.set(lm.id, {
        value: entry.value ?? QUALITY_LEVEL_SIGN[entry.level],
        color: QUALITY_LEVEL_COLOR[entry.level],
      });
    });
    return result.size > 0 ? result : undefined;
  }, [selectedMetricId, currentMap]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleTileClick = useCallback((q: number, r: number) => {
    const landmark = landmarkByCoord.get(`${q},${r}`);
    if (landmark) {
      setSelectedLandmark(landmark);
      setSelectedTile({ q, r });
      // Do NOT call setMainView — store would reset processMode
    }
  }, [landmarkByCoord, setSelectedLandmark, setSelectedTile]);

  const handleConnectionClick = useCallback(async (connectionId: string) => {
    if (!currentMap) return;
    if (pickingConnection && activeProcessId && activeStageId) {
      const proc = processes.find((p) => p.id === activeProcessId);
      const stage = proc?.stages.find((s) => s.id === activeStageId);
      if (!stage) return;
      const existing = stage.connections.find((sc) => sc.connectionId === connectionId);
      try {
        const updated = existing
          ? await removeConnectionFromStage(currentMap.id, activeProcessId, activeStageId, existing.id)
          : await addConnectionToStage(currentMap.id, activeProcessId, activeStageId, connectionId);
        setProcesses(updated);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update stage');
      }
      return;
    }
    setSelectedConnectionId(connectionId);
    setSelectedLandmark(null);
  }, [pickingConnection, activeProcessId, activeStageId, currentMap, processes, setProcesses, setSelectedConnectionId, setSelectedLandmark, setError]);

  const handleLandmarkSearch = useCallback((landmark: Parameters<typeof setSelectedLandmark>[0]) => {
    if (!landmark?.coordinate) return;
    setSelectedTile(landmark.coordinate);
    // Do NOT open landmark panel / change mainView in process mode
  }, [setSelectedTile]);

  if (!currentMap) return null;

  return (
    <>
      <div className="absolute inset-0">
        <ErrorBoundary fallback={
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            Failed to render 3D map. Please reload the page.
          </div>
        }>
          <HexGrid
            map={currentMap}
            onTileClick={handleTileClick}
            fpsRef={fpsRef}
            brushMode={false}
            crosshairCursor={pickingConnection}
            hideDecorations={true}
            rendererQualityProfile={rendererQualityProfile}
            highlightConnectionIds={activeProcessConnectionIds}
            activeStageConnectionIds={activeStageConnectionIds}
            processStageConnections={processStageConnections}
            landmarkHighlightColors={landmarkHighlightColors}
            stageHighlightTiles={stageHighlightTiles}
            metricOverlayEntries={metricOverlayEntries}
            onConnectionClick={handleConnectionClick}
            onFirstRender={() => dismissOverlayRef.current?.()}
          />
        </ErrorBoundary>
      </div>

      <MapInitOverlay
        tileCount={currentMap.map?.tiles?.length ?? 0}
        landmarkCount={Object.keys(currentMap.landmarks ?? {}).length}
        onDismiss={(fn) => { dismissOverlayRef.current = fn; }}
      />

      {/* Collaborator overlay: new connection + new process + search */}
      {isCollaborator && (
        <div className="absolute top-2 left-2 flex flex-row gap-1.5 z-10">
          <Button
            className="h-9 px-3 rounded-lg shadow-lg border gap-2 bg-card/80 text-muted-foreground border-border hover:text-foreground hover:bg-card"
            variant="ghost"
            onClick={() => setCreateConnOpen(true)}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="text-xs">New Connection</span>
          </Button>
          <Popover open={newProcPopoverOpen} onOpenChange={(o) => { setNewProcPopoverOpen(o); if (!o) { setNewProcName(''); setNewProcDesc(''); setNewProcError(''); } }}>
            <PopoverTrigger asChild>
              <Button
                className="h-9 px-3 rounded-lg shadow-lg border gap-2 bg-card/80 text-muted-foreground border-border hover:text-foreground hover:bg-card"
                variant="ghost"
              >
                <GitBranch className="h-4 w-4 shrink-0" />
                <span className="text-xs">New Process</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" side="bottom" align="start">
              <p className="text-sm font-semibold mb-3">Create Process</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-proc-name" className="text-xs">Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="new-proc-name"
                    value={newProcName}
                    onChange={(e) => setNewProcName(e.target.value)}
                    placeholder="Process name"
                    className="h-8 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProcess()}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-proc-desc" className="text-xs">Description</Label>
                  <Textarea
                    id="new-proc-desc"
                    value={newProcDesc}
                    onChange={(e) => setNewProcDesc(e.target.value)}
                    placeholder="Optional description…"
                    className="text-xs resize-none"
                    rows={3}
                  />
                </div>
                {newProcError && <p className="text-xs text-destructive">{newProcError}</p>}
                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleCreateProcess}
                  disabled={newProcSaving || !newProcName.trim()}
                >
                  {newProcSaving ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <LandmarkSearchField landmarks={positionedLandmarks} onSelect={handleLandmarkSearch} />
        </div>
      )}

      {/* Viewer overlay: search only */}
      {!isCollaborator && (
        <div className="absolute top-2 left-2 z-10">
          <LandmarkSearchField landmarks={positionedLandmarks} onSelect={handleLandmarkSearch} />
        </div>
      )}

      <div ref={fpsRef} className="absolute bottom-2 left-2 text-[10px] text-white/40 pointer-events-none font-mono" />

      {/* Metric layer selector – top-right, always visible in process mode */}
      {Object.keys(metrics).length > 0 && (() => {
        const allMetrics = Object.values(metrics);
        const selectedMetric = selectedMetricId ? (metrics)[selectedMetricId] : null;
        return (
          <div className="absolute top-2 right-2 z-10">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  className={`h-9 px-3 rounded-lg shadow-lg border gap-2 ${
                    selectedMetricId
                      ? 'bg-sky-950 text-sky-300 border-sky-700 hover:bg-sky-900'
                      : 'bg-card/80 text-muted-foreground border-border hover:text-foreground hover:bg-card'
                  }`}
                  variant="ghost"
                >
                  <Layers className="h-4 w-4 shrink-0" />
                  <span className="text-xs">{selectedMetric ? selectedMetric.name : 'Layers'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-1" side="bottom" align="end">
                <button
                  className={`flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs transition-colors ${
                    !selectedMetricId ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
                  }`}
                  onClick={() => setSelectedMetricId(null)}
                >
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                  None
                </button>
                {allMetrics.map((m) => (
                  <button
                    key={m.id}
                    className={`flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs transition-colors ${
                      selectedMetricId === m.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedMetricId(m.id)}
                    title={m.description}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0 border border-sky-400" />
                    {m.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        );
      })()}

      <CreateConnectionDialog
        open={createConnOpen}
        onClose={() => setCreateConnOpen(false)}
        mapId={currentMap.id}
        landmarks={positionedLandmarks}
        existingConnections={Object.values(currentMap.connections ?? {})}
        onCreated={updateMap}
      />
    </>
  );
}



