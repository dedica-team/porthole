import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMapStore } from '@/store/mapStore';
import type { Terrain } from '@/types/hex';
import { cn } from '@/lib/utils';
import { AlertTriangle, X } from 'lucide-react';

type EditorTool = 'RAISE' | 'LOWER' | 'TERRAIN';

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

export default function EditorPanel({ floating = false, error = '', onClearError }: EditorPanelProps) {
  const editorTool = useMapStore((s) => s.editorTool);
  const editorTerrain = useMapStore((s) => s.editorTerrain);
  const setEditorTool = useMapStore((s) => s.setEditorTool);
  const setEditorTerrain = useMapStore((s) => s.setEditorTerrain);
  const selectedTile = useMapStore((s) => s.selectedTile);
  const currentMap = useMapStore((s) => s.currentMap);
  const currentTileInfo = selectedTile && currentMap
    ? (() => {
        const t = (currentMap.map?.tiles ?? []).find(
          (tile) => tile.coordinate.q === selectedTile.q && tile.coordinate.r === selectedTile.r,
        );
        return t ? { elevation: t.elevation, terrain: t.terrain } : null;
      })()
    : null;
  const tools: { value: EditorTool; label: string }[] = [
    { value: 'RAISE', label: '▲ Raise' },
    { value: 'LOWER', label: '▼ Lower' },
    { value: 'TERRAIN', label: '🎨 Terrain' },
  ];

  const floatingButtonClass = (active: boolean) => cn(
    'h-9 px-3 rounded-lg shadow-lg border text-sm bg-card/80 backdrop-blur-sm hover:bg-card',
    active
      ? 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/10 hover:text-warning'
      : 'text-muted-foreground border-border hover:text-foreground',
  );

  if (floating) {
    return (
      <div className="absolute top-14 left-1/2 z-10 flex w-[min(calc(100%-1rem),72rem)] -translate-x-1/2 flex-col items-center gap-1.5 px-2">
        {error && (
          <Alert variant="destructive" className="pointer-events-auto w-full max-w-xl py-2 pr-2 shadow-lg">
            <AlertTriangle className="h-3.5 w-3.5" />
            <AlertDescription className="text-sm pr-4">{error}</AlertDescription>
            {onClearError && (
              <button
                className="absolute top-2 right-2 text-destructive-foreground/70 hover:text-destructive-foreground"
                onClick={onClearError}
                aria-label="Clear editor error"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Alert>
        )}

        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5">
          {tools.map((t) => (
            <Button
              key={t.value}
              variant="ghost"
              size="sm"
              className={floatingButtonClass(editorTool === t.value)}
              onClick={() => setEditorTool(t.value as EditorTool)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {editorTool === 'TERRAIN' && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5">
            {TERRAIN_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                className={floatingButtonClass(editorTerrain === opt.value)}
                style={editorTerrain === opt.value ? { borderColor: opt.color } : {}}
                onClick={() => setEditorTerrain(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        )}

        {selectedTile && currentTileInfo && (
          <div className="pointer-events-none rounded-full border border-border bg-card/90 px-3 py-1 text-sm text-muted-foreground shadow-lg backdrop-blur-sm">
            ({selectedTile.q}, {selectedTile.r}) · {currentTileInfo.elevation} · {TERRAIN_LABELS[currentTileInfo.terrain]}
          </div>
        )}
      </div>
    );
  }

  const content = (
    <div
      className={cn(
        'flex flex-col gap-4',
        'p-5',
      )}
    >
      {error && (
        <Alert variant="destructive" className="py-2 pr-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          <AlertDescription className="text-sm pr-4">{error}</AlertDescription>
          {onClearError && (
            <button
              className="absolute top-2 right-2 text-destructive-foreground/70 hover:text-destructive-foreground"
              onClick={onClearError}
              aria-label="Clear editor error"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Alert>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium uppercase tracking-wider">Landscape</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground uppercase tracking-wider">Tool</span>
        <div className="flex gap-1.5">
          {tools.map((t) => (
            <Button
              key={t.value}
              variant="ghost"
              size="sm"
              className={cn(
                'text-sm h-8',
                'flex-1',
                editorTool === t.value
                  ? 'bg-warning/10 text-warning border border-warning/30 hover:bg-warning/10 hover:text-warning'
                  : 'text-muted-foreground',
              )}
              onClick={() => setEditorTool(t.value as EditorTool)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>
      {editorTool === 'TERRAIN' && (
        <>
          <Separator className="bg-border" />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground uppercase tracking-wider">Terrain Type</span>
            <div className="flex flex-col gap-1.5">
              {TERRAIN_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'text-sm h-8 justify-start w-full',
                    editorTerrain === opt.value
                      ? 'bg-warning/10 text-warning border hover:bg-warning/10 hover:text-warning'
                      : 'text-muted-foreground',
                  )}
                  style={editorTerrain === opt.value ? { borderColor: opt.color } : {}}
                  onClick={() => setEditorTerrain(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
      {selectedTile && currentTileInfo && (
        <>
          <Separator className="bg-border" />
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground uppercase tracking-wider">Current Tile</span>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm text-muted-foreground">Position</span>
                <span className="text-sm font-mono">({selectedTile.q}, {selectedTile.r})</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm text-muted-foreground">Elevation</span>
                <Badge variant="secondary" className="text-sm h-5">{currentTileInfo.elevation}</Badge>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm text-muted-foreground">Terrain</span>
                <span className="text-sm text-right">{TERRAIN_LABELS[currentTileInfo.terrain]}</span>
              </div>
            </div>
          </div>
        </>
      )}
      <Separator className="bg-border" />
      <p className="text-sm text-muted-foreground leading-relaxed">
        Click tiles on the map to apply the selected tool.
      </p>
    </div>
  );

  return (
    content
  );
}