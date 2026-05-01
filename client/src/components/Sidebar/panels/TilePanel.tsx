import { useState, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import { toSlug } from '@/utils/slugUtils';
import type { Landmark, LandmarkType } from '@/types/landmark';
import { ALL_LANDMARK_TYPES, LANDMARK_TYPE_LABELS, isDecorative } from '@/types/landmark';
const TERRAIN_ICONS: Record<string, string> = {
  WATER: '💧', GRASS: '🌿', FOREST: '🌲', ROCKS: '🪨',
};

interface Props {
  onPlaceLandmark: (q: number, r: number, name: string, type: LandmarkType) => void;
  onPositionLandmark: (landmarkId: string, q: number, r: number) => void;
  loading: boolean;
}

export default function TilePanel({ onPlaceLandmark, onPositionLandmark, loading }: Props) {
  const selectedTile = useMapStore((s) => s.selectedTile);
  const currentMap = useMapStore((s) => s.currentMap);
  const setConfirmPending = useMapStore((s) => s.setConfirmPending);
  const relocatingLandmarkId = useMapStore((s) => s.relocatingLandmarkId);
  const setRelocatingLandmark = useMapStore((s) => s.setRelocatingLandmark);
  const userId = useAuthStore((s) => s.userId);

  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  const [showNameForm, setShowNameForm] = useState(false);
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<LandmarkType>('KEEP');
  const [wallId, setWallId] = useState<`${string}-${string}-${string}-${string}-${string}`>(
    () => crypto.randomUUID(),
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Regenerate UUID each time WALL is (re-)selected, and reset the editable id field
  useEffect(() => {
    if (selectedType === 'WALL') {
      setWallId(crypto.randomUUID());
    }
  }, [selectedType]);

  if (!selectedTile || !currentMap) return null;

  const tile = (currentMap.map?.tiles ?? []).find(
    (t) => t.coordinate.q === selectedTile.q && t.coordinate.r === selectedTile.r,
  );

  const landmarkOnTile: Landmark | undefined = Object.values(currentMap.landmarks ?? {}).find(
    (t) => t.coordinate != null && t.coordinate.q === selectedTile.q && t.coordinate.r === selectedTile.r,
  );

  const unpositionedLandmarks = Object.values(currentMap.landmarks ?? {})
    .filter((lm) => lm.coordinate == null && !isDecorative(lm.type))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredUnpositionedLandmarks = unpositionedLandmarks.filter((lm) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const typeLabel = LANDMARK_TYPE_LABELS[lm.type].toLowerCase();
    const groupName = lm.groupId ? (currentMap.groups?.[lm.groupId]?.name ?? '') : '';
    return lm.name.toLowerCase().includes(q) || typeLabel.includes(q) || groupName.toLowerCase().includes(q);
  });

  const canPlace = !landmarkOnTile && !!tile;

  const isDecorativeLandmark = isDecorative(selectedType);
  const slug = toSlug(name);
  const slugTaken = !isDecorativeLandmark && slug.length > 0 && Object.keys(currentMap.landmarks ?? {}).includes(slug);
  const wallIdTaken = isDecorativeLandmark && Object.keys(currentMap.landmarks ?? {}).includes(wallId.trim());
  // For decorative types, name is optional (falls back to the UUID); submit is blocked only by id collision or loading
  const canSubmit = (isDecorativeLandmark || name.trim().length > 0) && !slugTaken && !wallIdTaken && !loading;

  const handlePlaceClick = () => {
    if (!canPlace) return;
    setShowNameForm(true);
    setConfirmPending(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setShowNameForm(false);
    setConfirmPending(false);
    // For decorative types use the UUID as name fallback when the name field was left empty
    const effectiveName = isDecorativeLandmark && name.trim().length === 0 ? wallId : name.trim();
    setName('');
    onPlaceLandmark(selectedTile.q, selectedTile.r, effectiveName, selectedType);
  };

  const handleCancel = () => {
    setShowNameForm(false);
    setConfirmPending(false);
    setName('');
  };

  const landmarkOwner = landmarkOnTile
    ? currentMap.collaborators.find((c) => c.id === landmarkOnTile.ownerId)
    : null;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">Selected Tile</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Coordinates</span>
          <span className="text-xs font-mono text-foreground">
            ({selectedTile.q}, {selectedTile.r})
          </span>
        </div>
        {tile && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Terrain</span>
              <span className="text-xs text-foreground">
                {TERRAIN_ICONS[tile.terrain]} {tile.terrain.charAt(0) + tile.terrain.slice(1).toLowerCase()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Elevation</span>
              <Badge variant="secondary" className="text-[10px] h-5">{tile.elevation}</Badge>
            </div>
          </>
        )}
      </div>

       {landmarkOnTile && (
         <>
           <Separator className="bg-border" />
           <div className="flex flex-col gap-2">
             <div className="flex justify-between items-center">
               <span className="text-xs text-muted-foreground">Landmark</span>
               <span className="text-xs text-foreground">
                 {LANDMARK_TYPE_LABELS[landmarkOnTile.type]} · {landmarkOnTile.name}
               </span>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-xs text-muted-foreground">Owner</span>
               <span className="text-xs text-foreground">
                 {landmarkOwner?.username ?? 'Unknown'}
                 {landmarkOnTile.ownerId === userId && <span className="text-muted-foreground"> (you)</span>}
               </span>
             </div>
           </div>
         </>
       )}

       {relocatingLandmarkId && (
         <>
           <Separator className="bg-border" />
           <div className="flex flex-col gap-2">
             {currentMap.landmarks && currentMap.landmarks[relocatingLandmarkId] && (
               <>
                 <p className="text-[11px] text-muted-foreground">
                   Click an empty tile to relocate <strong>{currentMap.landmarks[relocatingLandmarkId].name}</strong>
                 </p>
                 {!landmarkOnTile && canPlace && (
                   <Button
                     size="sm"
                     className="w-full gap-2 h-9 py-2"
                     disabled={loading}
                     onClick={() => {
                       onPositionLandmark(relocatingLandmarkId, selectedTile.q, selectedTile.r);
                       setRelocatingLandmark(null);
                     }}
                   >
                     <span>🏗</span>
                     Relocate Here
                   </Button>
                 )}
               </>
             )}
             <Button
               size="sm"
               variant="ghost"
               className="w-full h-8 text-xs text-muted-foreground"
               disabled={loading}
               onClick={() => setRelocatingLandmark(null)}
             >
               Cancel Relocation
             </Button>
           </div>
         </>
       )}

       {!landmarkOnTile && !relocatingLandmarkId && (
        <>
          <Separator className="bg-border" />
          {!isCollaborator ? (
            <p className="text-[11px] text-muted-foreground">Join as collaborator to place landmarks.</p>
          ) : showNameForm ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <p className="text-[11px] text-muted-foreground">
                Choose a name and type for your landmark.
              </p>
              <Input
                autoFocus
                placeholder={isDecorativeLandmark ? 'Name (optional)' : 'e.g. Iron Keep'}
                maxLength={40}
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                className="h-8 text-xs"
              />
              {isDecorativeLandmark ? (
                <div className="flex flex-col gap-0.5">
                  <Input
                    placeholder="ID (UUID)"
                    value={wallId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setWallId(e.target.value as `${string}-${string}-${string}-${string}-${string}`)
                    }
                    className={`h-8 text-[10px] font-mono ${wallIdTaken ? 'border-destructive' : ''}`}
                    spellCheck={false}
                  />
                  {wallIdTaken && (
                    <p className="text-[10px] text-destructive">id already taken</p>
                  )}
                </div>
              ) : (
                slug.length > 0 && (
                  <p className={`text-[10px] font-mono ${slugTaken ? 'text-destructive' : 'text-muted-foreground'}`}>
                    id: {slug}{slugTaken ? ' · already taken' : ''}
                  </p>
                )
              )}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as LandmarkType)}
                className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                {ALL_LANDMARK_TYPES.map((t) => (
                  <option key={t} value={t}>{LANDMARK_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="flex-1 h-8 py-1 text-xs gap-1.5"
                  disabled={!canSubmit}
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{LANDMARK_TYPE_LABELS[selectedType].split(' ')[0]}</span>}
                  Create Landmark
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-xs text-muted-foreground"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="w-full gap-2 h-9 py-2"
                disabled={!canPlace || loading}
                onClick={handlePlaceClick}
              >
                <span>🏗</span>
                Create Landmark
              </Button>

              {canPlace && unpositionedLandmarks.length > 0 && (
                <div className="rounded-md border border-border/60 p-2.5 flex flex-col gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Position existing landmark</p>
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Search landmarks..."
                  />
                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                    {filteredUnpositionedLandmarks.map((lm) => {
                      const group = lm.groupId ? (currentMap.groups?.[lm.groupId] ?? null) : null;
                      return (
                        <Button
                          key={lm.id}
                          size="sm"
                          variant="outline"
                          className="justify-start h-auto min-h-7 py-1.5 text-[11px]"
                          disabled={loading}
                          onClick={() => onPositionLandmark(lm.id, selectedTile.q, selectedTile.r)}
                          title={`Place ${lm.name} at (${selectedTile.q}, ${selectedTile.r})`}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <span>{LANDMARK_TYPE_LABELS[lm.type]} · {lm.name}</span>
                            {group && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                                <span
                                  className="inline-block w-2 h-2 rounded-full border border-white/20"
                                  style={{ backgroundColor: group.color }}
                                  aria-label={`Group ${group.name}`}
                                />
                                {group.name}
                              </span>
                            )}
                          </span>
                        </Button>
                      );
                    })}
                    {filteredUnpositionedLandmarks.length === 0 && (
                      <p className="text-[11px] text-muted-foreground py-1 px-1">No matching landmarks found.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

