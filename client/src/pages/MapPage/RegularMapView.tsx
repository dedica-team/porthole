/**
 * RegularMapView
 *
 * Full-vegetation, terrain-editor map view.
 * Owns its tile-click handler, editor-toggle, fps ref and patch ref.
 * All CRUD actions come from the shared useMapPageActions hook via the `actions` prop.
 */
import { useRef, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HexGrid from '@/components/HexGrid/HexGrid';
import LandmarkSearchField from '@/components/LandmarkSearchField';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import { useShallow } from 'zustand/react/shallow';
import { positionLandmark, createConnection } from '@/api/mapApi';
import type { Terrain, Landmark } from '@/types/map';
import type { useMapPageActions } from './useMapPageActions';

interface Props {
  actions: ReturnType<typeof useMapPageActions>;
}

export default function RegularMapView({ actions }: Props) {
  const { cancelConnecting, fireEditTile, landmarkByCoord, tileByCoord, positionedLandmarks, withAction } = actions;

  const {
    currentMap,
    selectedTile, setSelectedTile,
    selectedLandmark, setSelectedLandmark,
    connectingFromLandmarkId,
    relocatingLandmarkId, setRelocatingLandmark,
    pendingConnectionMeta, setPendingConnectionMeta,
    editorMode, editorTool, editorTerrain, setEditorMode,
    mainView, setMainView, setConfirmPending,
  } = useMapStore(useShallow((s) => ({
    currentMap: s.currentMap,
    selectedTile: s.selectedTile, setSelectedTile: s.setSelectedTile,
    selectedLandmark: s.selectedLandmark, setSelectedLandmark: s.setSelectedLandmark,
    connectingFromLandmarkId: s.connectingFromLandmarkId,
    relocatingLandmarkId: s.relocatingLandmarkId, setRelocatingLandmark: s.setRelocatingLandmark,
    pendingConnectionMeta: s.pendingConnectionMeta, setPendingConnectionMeta: s.setPendingConnectionMeta,
    editorMode: s.editorMode, editorTool: s.editorTool, editorTerrain: s.editorTerrain, setEditorMode: s.setEditorMode,
    mainView: s.mainView, setMainView: s.setMainView, setConfirmPending: s.setConfirmPending,
  })));

  const userId = useAuthStore((s) => s.userId);
  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  const patchTileRef = useRef<((q: number, r: number, terrain: Terrain, elevation: number) => void) | null>(null);
  const fpsRef = useRef<HTMLDivElement>(null);

  const handleEditorToggle = useCallback(() => {
    const next = !editorMode;
    setEditorMode(next);
    if (!next) { setSelectedLandmark(null); setSelectedTile(null); }
  }, [editorMode, setEditorMode, setSelectedLandmark, setSelectedTile]);

  const handleTileClick = useCallback((q: number, r: number) => {
    const landmark = landmarkByCoord.get(`${q},${r}`);

    if (editorMode) {
      const tile = tileByCoord.get(`${q},${r}`);
      if (!tile) return;
      setSelectedTile({ q, r });
      if (editorTool === 'RAISE')      fireEditTile(q, r, Math.min(5, tile.elevation + 1), undefined, patchTileRef);
      else if (editorTool === 'LOWER') fireEditTile(q, r, Math.max(0, tile.elevation - 1), undefined, patchTileRef);
      else                              fireEditTile(q, r, undefined, editorTerrain, patchTileRef);
      return;
    }

    if (relocatingLandmarkId) {
      if (!landmark) {
        withAction(() => positionLandmark(currentMap!.id, relocatingLandmarkId, q, r));
        setRelocatingLandmark(null);
        setMainView('idle');
      }
      return;
    }

    if (connectingFromLandmarkId) {
      if (landmark && landmark.id !== connectingFromLandmarkId) {
        withAction(() => createConnection(
          currentMap!.id, connectingFromLandmarkId, landmark.id,
          pendingConnectionMeta.type, pendingConnectionMeta.name, pendingConnectionMeta.description,
        ));
        cancelConnecting();
        setPendingConnectionMeta({ type: 'PIPE' });
        setMainView('idle');
      } else if (!landmark) {
        cancelConnecting();
        setPendingConnectionMeta({ type: 'PIPE' });
        setMainView('idle');
      }
      return;
    }

    if (landmark) {
      setSelectedLandmark(landmark); setSelectedTile({ q, r });
      setMainView('landmark'); setConfirmPending(false);
      return;
    }

    setSelectedLandmark(null); setSelectedTile({ q, r });
    setMainView('tile'); setConfirmPending(false);
  }, [
    landmarkByCoord, tileByCoord, editorMode, editorTool, editorTerrain,
    relocatingLandmarkId, connectingFromLandmarkId, pendingConnectionMeta, currentMap,
    fireEditTile, withAction, cancelConnecting,
    setSelectedTile, setSelectedLandmark, setMainView, setConfirmPending,
    setPendingConnectionMeta, setRelocatingLandmark,
  ]);

  const handleLandmarkSearch = useCallback((landmark: Landmark) => {
    if (!landmark.coordinate) return;
    setSelectedTile(landmark.coordinate);
    setSelectedLandmark(landmark);
    setMainView('landmark');
    setConfirmPending(false);
  }, [setSelectedTile, setSelectedLandmark, setMainView, setConfirmPending]);

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
            brushMode={editorMode}
            crosshairCursor={!!connectingFromLandmarkId || !!relocatingLandmarkId}
            patchTileRef={patchTileRef}
            hideDecorations={false}
          />
        </ErrorBoundary>
      </div>

      {isCollaborator && (
        <div className="absolute top-2 left-2 flex flex-row gap-1.5 z-10">
          <Button
            className={`h-9 px-3 rounded-lg shadow-lg border gap-2 ${editorMode
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30 hover:text-amber-300'
              : 'bg-card/80 text-muted-foreground border-border hover:text-foreground hover:bg-card'}`}
            variant="ghost" onClick={handleEditorToggle} aria-pressed={editorMode}
          >
            <Pencil className="h-4 w-4 shrink-0" />
            <span className="text-xs">{editorMode ? 'Exit landscape editor' : 'Landscape editor'}</span>
          </Button>
          <LandmarkSearchField landmarks={positionedLandmarks} onSelect={handleLandmarkSearch} />
        </div>
      )}
      {!isCollaborator && (
        <div className="absolute top-2 left-2 z-10">
          <LandmarkSearchField landmarks={positionedLandmarks} onSelect={handleLandmarkSearch} />
        </div>
      )}

      <div ref={fpsRef} className="absolute bottom-2 left-2 text-[10px] text-white/40 pointer-events-none font-mono" />

      {(mainView === 'tile' || mainView === 'landmark') && selectedTile && !editorMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-card/90 border border-border text-[11px] text-muted-foreground pointer-events-none z-10">
          ({selectedTile.q}, {selectedTile.r})
          {selectedLandmark && <> · {selectedLandmark.type.replace('_', ' ')}</>}
        </div>
      )}
    </>
  );
}

