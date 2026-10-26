import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { useAuthStore, useMapStore } from '@/store/mapStore';
import { regenerateMapTerrain, type MapSize } from '@/api/mapApi';
import { RegenerateTerrainDialog } from '@/components/RegenerateTerrainDialog';
import type { Terrain } from '@/types/hex';
import { cn } from '@/lib/utils';
import { AlertTriangle, MapPin, Paintbrush, RefreshCw, Trees, X } from 'lucide-react';

export type EditorTool = 'NONE' | 'RAISE' | 'LOWER' | 'TERRAIN';

const TERRAIN_OPTIONS: { value: Terrain; label: string; color: string }[] = [
  { value: 'WATER',    label: '💧 Water',    color: '#1a6b9a' },
  { value: 'GRASS',    label: '🌿 Grass',    color: '#4caf50' },
  { value: 'MEADOW',   label: '🌸 Meadow',   color: '#7ec850' },
  { value: 'FOREST',   label: '🌲 Forest',   color: '#2d6a2d' },
  { value: 'ROCKS',    label: '🪨 Rocks',    color: '#7a7060' },
  { value: 'DESERT',   label: '🏜️ Desert',   color: '#d4a84b' },
  { value: 'BEACH',    label: '🏖️ Beach',    color: '#e8d48b' },
  { value: 'SWAMP',    label: '🌿 Swamp',    color: '#4a5e3a' },
  { value: 'SCORCHED', label: '🔥 Scorched', color: '#2a1a0a' },
  { value: 'SNOWY',    label: '❄️ Snowy',    color: '#ddeeff' },
  { value: 'ICE',      label: '🧊 Ice',      color: '#a8d8ea' },
];
const TERRAIN_LABELS: Record<Terrain, string> = {
  WATER: '💧 Water', GRASS: '🌿 Grass', MEADOW: '🌸 Meadow', FOREST: '🌲 Forest', ROCKS: '🪨 Rocks',
  DESERT: '🏜️ Desert', BEACH: '🏖️ Beach', SWAMP: '🌿 Swamp', SCORCHED: '🔥 Scorched',
  SNOWY: '❄️ Snowy', ICE: '🧊 Ice',
};

interface EditorPanelProps {
  floating?: boolean;
  error?: string;
  onClearError?: () => void;
}

/**
 * EditorPanel renders the landscape editing controls as top-right overlay panels,
 * matching the visual design, positioning, and behavior of the X-Ray process overlays.
 */
export default function EditorPanel({ error = '', onClearError }: EditorPanelProps) {
  const editorTool = useMapStore((s) => s.editorTool);
  const editorTerrain = useMapStore((s) => s.editorTerrain);
  const setEditorTool = useMapStore((s) => s.setEditorTool);
  const setEditorTerrain = useMapStore((s) => s.setEditorTerrain);
  const selectedTile = useMapStore((s) => s.selectedTile);
  const currentMap = useMapStore((s) => s.currentMap);
  const updateMap = useMapStore((s) => s.updateMap);
  const userId = useAuthStore((s) => s.userId);

  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState('');

  const isCollaborator = !currentMap || (!!userId && currentMap.collaborators.some((c) => c.id === userId));

  const handleOpenRegenerateDialog = () => {
    setRegenerateError('');
    setShowRegenerateDialog(true);
  };

  const handleRegenerateTerrain = async (options: { mapSize?: MapSize; cols?: number; rows?: number }) => {
    if (!currentMap) return;
    setRegenerating(true);
    setRegenerateError('');
    try {
      const updated = await regenerateMapTerrain(currentMap.id, options);
      updateMap(updated);
      setShowRegenerateDialog(false);
    } catch (err: unknown) {
      setRegenerateError(err instanceof Error ? err.message : 'Failed to regenerate terrain');
    } finally {
      setRegenerating(false);
    }
  };

  const displayedError = error || regenerateError;
  const handleClearError = () => {
    setRegenerateError('');
    onClearError?.();
  };

  const currentTileInfo = selectedTile && currentMap
    ? (() => {
        const t = (currentMap.map?.tiles ?? []).find(
          (tile) => tile.coordinate.q === selectedTile.q && tile.coordinate.r === selectedTile.r,
        );
        return t ? { elevation: t.elevation, terrain: t.terrain } : null;
      })()
    : null;

  const tools: { value: EditorTool; label: string }[] = [
    { value: 'NONE', label: '✋ None' },
    { value: 'RAISE', label: '▲ Raise' },
    { value: 'LOWER', label: '▼ Lower' },
    { value: 'TERRAIN', label: '🎨 Terrain' },
  ];

  return (
    <>
      <div className="absolute top-2 right-3 sm:right-6 flex flex-col items-end gap-2 z-10 pointer-events-auto">
        {/* Error notification */}
        {displayedError && (
          <Alert variant="destructive" className="w-full min-w-44 max-w-64 py-2 pr-2 shadow-lg">
            <AlertTriangle className="h-3.5 w-3.5" />
            <AlertDescription className="text-sm pr-4">{displayedError}</AlertDescription>
            {(onClearError || regenerateError) && (
              <button
                className="absolute top-2 right-2 text-destructive-foreground/70 hover:text-destructive-foreground cursor-pointer"
                onClick={handleClearError}
                aria-label="Clear editor error"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Alert>
        )}

        {/* Landscape Tools Box */}
        <div className="flex flex-col rounded-lg shadow-lg border border-border bg-card/80 backdrop-blur-xs min-w-44 max-w-64 w-48 sm:w-56 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2">
            <Trees className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm font-semibold text-foreground">Landscape</span>
          </div>
          <div className="flex flex-col p-1.5 gap-1">
            {tools.map((t) => {
              const isActive = editorTool === t.value;
              return (
                <Button
                  key={t.value}
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'w-full justify-start h-8 px-2.5 rounded-md gap-2 text-left',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/40 hover:bg-primary/15'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                  onClick={() => setEditorTool(t.value as EditorTool)}
                >
                  <span className="text-sm truncate">{t.label}</span>
                </Button>
              );
            })}
            {isCollaborator && (
              <>
                <Separator className="bg-border/60 my-0.5" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start h-8 px-2.5 rounded-md gap-2 text-left text-muted-foreground hover:text-foreground hover:bg-accent"
                  disabled={regenerating}
                  onClick={handleOpenRegenerateDialog}
                  title="Regenerate terrain"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5 shrink-0', regenerating && 'animate-spin')} />
                  <span className="text-sm truncate">{regenerating ? 'Regenerating…' : 'Regenerate terrain'}</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Terrain Biomes Palette Box (when Terrain tool is active) */}
        {editorTool === 'TERRAIN' && (
          <div className="flex flex-col rounded-lg shadow-lg border border-border bg-card/80 backdrop-blur-xs min-w-44 max-w-64 w-48 sm:w-56 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <Paintbrush className="h-3.5 w-3.5 shrink-0" />
              <span className="text-sm font-semibold text-foreground">Terrain Type</span>
            </div>
            <div className="flex flex-col p-1.5 gap-1 max-h-72 overflow-y-auto">
              {TERRAIN_OPTIONS.map((opt) => {
                const isActive = editorTerrain === opt.value;
                return (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant="ghost"
                    className={cn(
                      'w-full justify-start h-8 px-2.5 rounded-md gap-2 text-left',
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary/40 hover:bg-primary/15'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    )}
                    style={isActive ? { borderColor: opt.color } : {}}
                    onClick={() => setEditorTerrain(opt.value)}
                  >
                    <span className="text-sm truncate">{opt.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Tile Details Box */}
        {selectedTile && currentTileInfo && (
          <div className="flex flex-col rounded-lg shadow-lg border border-border bg-card/80 backdrop-blur-xs min-w-44 max-w-64 w-48 sm:w-56 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="text-sm font-semibold text-foreground">Selected Tile</span>
            </div>
            <div className="flex flex-col px-3 py-2 gap-1.5 text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Position</span>
                <span className="font-mono">({selectedTile.q}, {selectedTile.r})</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Elevation</span>
                <StatusBadge status="NONE" className="text-sm h-5">{currentTileInfo.elevation}</StatusBadge>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Terrain</span>
                <span className="text-sm text-right">{TERRAIN_LABELS[currentTileInfo.terrain]}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <RegenerateTerrainDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        onConfirm={handleRegenerateTerrain}
        loading={regenerating}
        error={regenerateError}
      />
    </>
  );
}