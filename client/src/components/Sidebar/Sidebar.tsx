import { AlertTriangle, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useMapStore } from '@/store/mapStore';
import TilePanel from './panels/TilePanel';
import LandmarkPanel from './panels/LandmarkPanel';
import EditorPanel from './panels/EditorPanel';
import MetricsPanel from './panels/MetricsPanel';
import ProcessPanel from './panels/ProcessPanel';
import type { LandmarkType, ConnectionType, QualityLevel } from '@/types/map';
import { CONNECTION_TYPE_LABELS } from '@/types/map';

// ── ProcessConnectionView ────────────────────────────────────────────────────
function ProcessConnectionView({ onClose }: { onClose: () => void }) {
  const selectedConnectionId = useMapStore((s) => s.selectedConnectionId);
  const currentMap = useMapStore((s) => s.currentMap);
  const processes = useMapStore((s) => s.processes);
  const setActiveProcessId = useMapStore((s) => s.setActiveProcessId);
  const setActiveStageId = useMapStore((s) => s.setActiveStageId);
  const setSelectedConnectionId = useMapStore((s) => s.setSelectedConnectionId);

  const conn = selectedConnectionId ? (currentMap?.connections ?? {})[selectedConnectionId] : null;
  const originLandmark = conn ? (currentMap?.landmarks ?? {})[conn.originId] : null;
  const targetLandmark = conn ? (currentMap?.landmarks ?? {})[conn.targetId] : null;

  // Collect process stages that include this connection
  const relatedStages = (() => {
    if (!selectedConnectionId) return [];
    const result: { processId: string; processName: string; stageId: string; stageName: string; stageIndex: number }[] = [];
    processes.forEach((proc) => {
      proc.stages.forEach((stage, si) => {
        if (stage.connections.some((sc) => sc.connectionId === selectedConnectionId)) {
          result.push({ processId: proc.id, processName: proc.name ?? '', stageId: stage.id, stageName: stage.name ?? '', stageIndex: si + 1 });
        }
      });
    });
    return result;
  })();

  const handleNavigate = (processId: string, stageId: string) => {
    setActiveProcessId(processId);
    setActiveStageId(stageId);
    setSelectedConnectionId(null);
  };

  if (!conn) return null;
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-end px-2 pt-2 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">{conn.name ?? '—'}</span>
          {conn.description && <span className="text-[11px] text-muted-foreground leading-relaxed">{conn.description}</span>}
          <span className="text-[10px] text-muted-foreground mt-0.5">{CONNECTION_TYPE_LABELS[conn.type ?? 'PIPE']}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground shrink-0">From</span>
            <span className="text-xs text-foreground truncate">{originLandmark?.name ?? conn.originId}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground shrink-0">To</span>
            <span className="text-xs text-foreground truncate">{targetLandmark?.name ?? conn.targetId}</span>
          </div>
        </div>
        {relatedStages.length > 0 && (
          <>
            <Separator className="bg-border" />
            <span className="text-xs text-muted-foreground">Used in processes</span>
            <div className="flex flex-col gap-1">
              {relatedStages.map((rs, i) => (
                <button
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 hover:bg-accent/40 transition-colors cursor-pointer text-left w-full"
                  onClick={() => handleNavigate(rs.processId, rs.stageId)}
                >
                  <span className="text-xs font-medium text-foreground truncate">{rs.processName}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">Stage {rs.stageIndex}: {rs.stageName}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {relatedStages.length === 0 && (
          <span className="text-[11px] text-muted-foreground italic">Not used in any process stage</span>
        )}
      </div>
    </div>
  );
}

// ── ProcessLandmarkView ──────────────────────────────────────────────────────
interface ProcessLandmarkViewProps {
  onStartConnection: Props['onStartConnection'];
  onEditLandmark: Props['onEditLandmark'];
  onRemoveLandmark: () => void;
  onEditConnection: Props['onEditConnection'];
  onRemoveConnection: (id: string) => void;
  onSetLandmarkMetric: Props['onSetLandmarkMetric'];
  onClearLandmarkMetric: Props['onClearLandmarkMetric'];
  loading: boolean;
  onClose: () => void;
}

function ProcessLandmarkView({
  onStartConnection, onEditLandmark, onRemoveLandmark, onEditConnection, onRemoveConnection,
  onSetLandmarkMetric, onClearLandmarkMetric, loading, onClose,
}: ProcessLandmarkViewProps) {
  const selectedLandmark = useMapStore((s) => s.selectedLandmark);
  const currentMap = useMapStore((s) => s.currentMap);
  const processes = useMapStore((s) => s.processes);
  const processMode = useMapStore((s) => s.processMode);
  const setActiveProcessId = useMapStore((s) => s.setActiveProcessId);
  const setActiveStageId = useMapStore((s) => s.setActiveStageId);
  const setSelectedLandmark = useMapStore((s) => s.setSelectedLandmark);
  const setSelectedTile = useMapStore((s) => s.setSelectedTile);

  // Collect process stages that involve any connection touching this landmark
  const relatedStages = (() => {
    if (!selectedLandmark || !currentMap || !processMode) return [];
    const connIds = new Set(
      Object.values(currentMap.connections ?? {})
        .filter((c) => c.originId === selectedLandmark.id || c.targetId === selectedLandmark.id)
        .map((c) => c.id),
    );
    const result: { processId: string; processName: string; stageId: string; stageName: string; stageIndex: number }[] = [];
    processes.forEach((proc) => {
      proc.stages.forEach((stage, si) => {
        const hasConn = stage.connections.some((sc) => connIds.has(sc.connectionId));
        if (hasConn) result.push({ processId: proc.id, processName: proc.name ?? '', stageId: stage.id, stageName: stage.name ?? '', stageIndex: si + 1 });
      });
    });
    return result;
  })();

  const handleNavigateToProcess = (processId: string, stageId: string) => {
    setActiveProcessId(processId);
    setActiveStageId(stageId);
    setSelectedLandmark(null);
    setSelectedTile(null);
  };

  return (
    <div className="flex flex-col">
      {/* Back / close button – only in process mode (normal mode uses the global close button) */}
      {processMode && (
        <div className="flex items-center justify-end px-2 pt-2 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Back to process">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {/* Landmark details */}
      <LandmarkPanel
        onStartConnection={onStartConnection}
        onRemoveLandmark={onRemoveLandmark}
        onEditLandmark={onEditLandmark}
        onEditConnection={onEditConnection}
        onRemoveConnection={onRemoveConnection}
        onSetLandmarkMetric={onSetLandmarkMetric}
        onClearLandmarkMetric={onClearLandmarkMetric}
        loading={loading}
      />
      {/* Related processes – only in process mode */}
      {processMode && relatedStages.length > 0 && (
        <div className="flex flex-col gap-2 px-5 pb-5">
          <Separator className="bg-border" />
          <span className="text-xs text-muted-foreground">Used in processes</span>
          <div className="flex flex-col gap-1">
            {relatedStages.map((rs, i) => (
              <button
                key={i}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 hover:bg-accent/40 transition-colors cursor-pointer text-left w-full"
                onClick={() => handleNavigateToProcess(rs.processId, rs.stageId)}
              >
                <span className="text-xs font-medium text-foreground truncate">{rs.processName}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">Stage {rs.stageIndex}: {rs.stageName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
interface Props {
  onPlaceLandmark: (q: number, r: number, name: string, type: LandmarkType) => void;
  onPositionLandmark: (landmarkId: string, q: number, r: number) => void;
  onStartConnection: (type: ConnectionType, name?: string, description?: string) => void;
  onCancelConnection: () => void;
  onRemoveLandmark: () => void;
  onEditLandmark: (landmarkId: string, name?: string, type?: LandmarkType, description?: string, groupId?: string, clearGroup?: boolean, link?: string, clearLink?: boolean) => void;
  onEditConnection: (connectionId: string, type?: ConnectionType, name?: string, description?: string, clearName?: boolean, clearDescription?: boolean) => void;
  onRemoveConnection: (connectionId: string) => void;
  onCreateMetric: (name: string, description: string) => void;
  onEditMetric: (metricId: string, name?: string, description?: string) => void;
  onRemoveMetric: (metricId: string) => void;
  onSetLandmarkMetric: (landmarkId: string, metricId: string, value: string | undefined, level: QualityLevel, link?: string, badges?: Record<string, string>) => void;
  onClearLandmarkMetric: (landmarkId: string, metricId: string) => void;
  loading: boolean;
  error: string;
  onClearError: () => void;
}

export default function Sidebar({
  onPlaceLandmark,
  onPositionLandmark,
  onStartConnection,
  onCancelConnection,
  onRemoveLandmark,
  onEditLandmark,
  onEditConnection,
  onRemoveConnection,
  onCreateMetric,
  onEditMetric,
  onRemoveMetric,
  onSetLandmarkMetric,
  onClearLandmarkMetric,
  loading,
  error,
  onClearError,
}: Props) {
  const mainView = useMapStore((s) => s.mainView);
  const setMainView = useMapStore((s) => s.setMainView);
  const setSelectedTile = useMapStore((s) => s.setSelectedTile);
  const setSelectedLandmark = useMapStore((s) => s.setSelectedLandmark);
  const selectedLandmark = useMapStore((s) => s.selectedLandmark);
  const selectedConnectionId = useMapStore((s) => s.selectedConnectionId);
  const setSelectedConnectionId = useMapStore((s) => s.setSelectedConnectionId);
  const connectingFromLandmarkId = useMapStore((s) => s.connectingFromLandmarkId);
  const relocatingLandmarkId = useMapStore((s) => s.relocatingLandmarkId);
  const setRelocatingLandmark = useMapStore((s) => s.setRelocatingLandmark);
  const editorMode = useMapStore((s) => s.editorMode);
  const processMode = useMapStore((s) => s.processMode);

  // Hide sidebar when nothing is selected and not in editor/process mode
  const isVisible = editorMode || processMode || mainView !== 'idle' || !!connectingFromLandmarkId || !!relocatingLandmarkId;
  if (!isVisible) return null;

  const handleClose = () => {
    setSelectedTile(null);
    setSelectedLandmark(null);
    setMainView('idle');
  };

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex flex-col w-(--sidebar-width) min-w-0 bg-card border-l border-border overflow-hidden md:relative md:shrink-0">
      {/* Close button – always visible top-right */}
      {!editorMode && !processMode && (
        <div className="flex items-center justify-end px-2 pt-2 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleClose}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Connecting-Banner – hide in process mode */}
      {connectingFromLandmarkId && !processMode && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-sky-950 border-b border-sky-800 shrink-0">
          <span className="text-[11px] text-sky-300">Click a target landmark to connect</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-[10px] text-sky-400 hover:text-sky-200"
            onClick={onCancelConnection}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Relocating-Banner */}
      {relocatingLandmarkId && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-950 border-b border-amber-800 shrink-0">
          <span className="text-[11px] text-amber-300">Click an empty tile to relocate</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-[10px] text-amber-400 hover:text-amber-200"
            onClick={() => setRelocatingLandmark(null)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Error-Alert */}
      {error && (
        <div className="px-4 pt-4 shrink-0">
          <Alert variant="destructive" className="py-2 pr-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <AlertDescription className="text-[11px] pr-4">{error}</AlertDescription>
            <button
              className="absolute top-2 right-2 text-destructive-foreground/70 hover:text-destructive-foreground"
              onClick={onClearError}
            >
              <X className="h-3 w-3" />
            </button>
          </Alert>
        </div>
      )}

      {/* Panel content */}
      <ScrollArea className="flex-1">
        {processMode ? (
          selectedLandmark ? (
            <ProcessLandmarkView
              onStartConnection={onStartConnection}
              onEditLandmark={onEditLandmark}
              onRemoveLandmark={onRemoveLandmark}
              onEditConnection={onEditConnection}
              onRemoveConnection={onRemoveConnection}
              onSetLandmarkMetric={onSetLandmarkMetric}
              onClearLandmarkMetric={onClearLandmarkMetric}
              loading={loading}
              onClose={() => { setSelectedTile(null); setSelectedLandmark(null); }}
            />
          ) : selectedConnectionId ? (
            <ProcessConnectionView onClose={() => setSelectedConnectionId(null)} />
          ) : (
            <ProcessPanel />
          )
        ) : editorMode ? (
          <EditorPanel />
        ) : (
          <>
            {mainView === 'tile' && (
              <TilePanel onPlaceLandmark={onPlaceLandmark} onPositionLandmark={onPositionLandmark} loading={loading} />
            )}
            {mainView === 'landmark' && (
              <ProcessLandmarkView
                onStartConnection={onStartConnection}
                onRemoveLandmark={onRemoveLandmark}
                onEditLandmark={onEditLandmark}
                onEditConnection={onEditConnection}
                onRemoveConnection={onRemoveConnection}
                onSetLandmarkMetric={onSetLandmarkMetric}
                onClearLandmarkMetric={onClearLandmarkMetric}
                loading={loading}
                onClose={handleClose}
              />
            )}
            {mainView === 'metrics' && (
              <MetricsPanel
                onCreateMetric={onCreateMetric}
                onEditMetric={onEditMetric}
                onRemoveMetric={onRemoveMetric}
                loading={loading}
              />
            )}
            {mainView === 'editor' && <EditorPanel />}
          </>
        )}
      </ScrollArea>
    </aside>
  );
}
