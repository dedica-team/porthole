import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMapStore } from '@/store/mapStore';
import type { Terrain } from '@/types/map';
import { cn } from '@/lib/utils';
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
export default function EditorPanel() {
  const editorTool = useMapStore((s) => s.editorTool);
  const editorTerrain = useMapStore((s) => s.editorTerrain);
  const setEditorTool = useMapStore((s) => s.setEditorTool);
  const setEditorTerrain = useMapStore((s) => s.setEditorTerrain);
  const setEditorMode = useMapStore((s) => s.setEditorMode);
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
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider ">Landscape Editor</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setEditorMode(false)}
        >
          X
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tool</span>
        <div className="flex gap-1.5">
          {tools.map((t) => (
            <Button
              key={t.value}
              variant="ghost"
              size="sm"
              className={cn(
                'flex-1 text-xs h-8',
                editorTool === t.value
                  ? 'bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-950 hover:text-amber-300'
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
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Terrain Type</span>
            <div className="flex flex-col gap-1.5">
              {TERRAIN_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'w-full justify-start text-xs h-8',
                    editorTerrain === opt.value
                      ? 'bg-amber-950 text-amber-300 border hover:bg-amber-950 hover:text-amber-300'
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
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Current Tile</span>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Position</span>
              <span className="text-xs font-mono">({selectedTile.q}, {selectedTile.r})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Elevation</span>
              <Badge variant="secondary" className="text-[10px] h-5">{currentTileInfo.elevation}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Terrain</span>
              <span className="text-xs">{TERRAIN_LABELS[currentTileInfo.terrain]}</span>
            </div>
          </div>
        </>
      )}
      <Separator className="bg-border" />
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Click tiles on the map to apply the selected tool.
      </p>
    </div>
  );
}
