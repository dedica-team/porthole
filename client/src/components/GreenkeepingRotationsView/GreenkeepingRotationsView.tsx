import { useEffect, useState } from 'react';
import { ChevronRight, ExternalLink, FastForward, Plus } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Button } from '@/components/ui/button';
import {
  advanceGreenkeepingRotation,
  fetchGreenkeepingRotations,
} from '@/api/mapApi';
import { useAuthStore, useMapStore } from '@/store/mapStore';
import type { GreenkeepingRotation } from '@/types/greenkeeping';
import {
  getActiveGreenkeepingEntry,
} from '@/types/greenkeeping';
import CreateEditGreenkeepingRotationDialog from './CreateEditGreenkeepingRotationDialog';

export default function GreenkeepingRotationsView() {
  const currentMap = useMapStore((s) => s.currentMap);
  const greenkeepingRotations = useMapStore((s) => s.greenkeepingRotations);
  const setGreenkeepingRotations = useMapStore((s) => s.setGreenkeepingRotations);
  const greenkeepingRotationsFetched = useMapStore((s) => s.greenkeepingRotationsFetched);
  const setGreenkeepingRotationsFetched = useMapStore((s) => s.setGreenkeepingRotationsFetched);
  const greenkeepingRotationsLoading = useMapStore((s) => s.greenkeepingRotationsLoading);
  const setGreenkeepingRotationsLoading = useMapStore((s) => s.setGreenkeepingRotationsLoading);
  const greenkeepingRotationsError = useMapStore((s) => s.greenkeepingRotationsError);
  const setGreenkeepingRotationsError = useMapStore((s) => s.setGreenkeepingRotationsError);
  const userId = useAuthStore((s) => s.userId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRotation, setEditingRotation] = useState<GreenkeepingRotation | null>(null);
  const [actionError, setActionError] = useState('');
  const [busyRotationId, setBusyRotationId] = useState<string | null>(null);

  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  useEffect(() => {
    if (!currentMap || greenkeepingRotationsFetched) return;
    setGreenkeepingRotationsLoading(true);
    fetchGreenkeepingRotations(currentMap.id)
      .then((rotations) => {
        setGreenkeepingRotations(rotations);
        setGreenkeepingRotationsFetched(true);
      })
      .catch((err: unknown) => setGreenkeepingRotationsError(err instanceof Error ? err.message : 'Failed to load rotations.'))
      .finally(() => setGreenkeepingRotationsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMap?.id, greenkeepingRotationsFetched]);

  if (!currentMap) return null;

  const collaboratorMap = Object.fromEntries(currentMap.collaborators.map((c) => [c.id, c]));
  const sortedRotations = [...greenkeepingRotations].sort((a, b) => a.name.localeCompare(b.name));

  const handleAdvance = async (rotationId: string) => {
    setBusyRotationId(rotationId);
    setActionError('');
    try {
      const updated = await advanceGreenkeepingRotation(currentMap.id, rotationId);
      setGreenkeepingRotations(greenkeepingRotations.map((r) => r.id === updated.id ? updated : r));
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to advance rotation.');
    } finally {
      setBusyRotationId(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b border-border px-6 py-3 shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Greenkeeping Rotations</h2>
        {isCollaborator && (
          <Button size="sm" variant="default" className="h-7 gap-1.5 text-sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Rotation
          </Button>
        )}
      </div>

      {(greenkeepingRotationsError || actionError) && (
        <p className="px-6 py-2 text-sm text-destructive shrink-0">{greenkeepingRotationsError || actionError}</p>
      )}

      {greenkeepingRotationsLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : sortedRotations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          No greenkeeping rotations yet.{isCollaborator ? ' Create one with "Rotation".' : ''}
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-6 py-3">
          <div className="grid grid-cols-3 gap-2 items-stretch">
            {sortedRotations.map((rotation) => {
              const activeEntry = getActiveGreenkeepingEntry(rotation);
              const activeIndex = activeEntry
                ? rotation.collaborators.findIndex((e) => e.id === activeEntry.id)
                : -1;
              const groups = rotation.groupIds.map((gid) => currentMap.groups[gid]).filter(Boolean);
              const isBusy = busyRotationId === rotation.id;
              const canAdvance = isCollaborator && rotation.collaborators.length > 1;

              return (
                <Button
                  key={rotation.id}
                  variant="ghost"
                  className="group h-full w-full !flex-col !items-start !justify-start !whitespace-normal text-left px-4 py-3"
                  onClick={() => { if (isCollaborator) { setActionError(''); setEditingRotation(rotation); } }}
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 w-full">
                    <span className="font-medium text-lg text-foreground">{rotation.name}</span>
                    {groups.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1 shrink-0">
                        {groups.map((g) => (
                          <span key={g.id} className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-xs text-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                            {g.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {rotation.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{rotation.description}</p>
                  )}

                  {/* Link */}
                  {rotation.link && (
                    <a
                      href={rotation.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 mt-0.5 text-xs text-[hsl(185,100%,54%)] hover:underline truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{rotation.link}</span>
                    </a>
                  )}

                  {/* Rotation order */}
                  {rotation.collaborators.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      {rotation.collaborators.map((entry, index) => {
                        const collab = collaboratorMap[entry.collaboratorId];
                        const username = collab?.username ?? 'Unknown';
                        const isActive = activeEntry?.id === entry.id;
                        const followsActive = activeIndex >= 0 && index === activeIndex + 1;
                        const showTrailingAdvance = canAdvance && isActive && activeIndex === rotation.collaborators.length - 1;

                        return (
                          <div key={entry.id} className="flex items-center gap-1">
                            {index > 0 && (
                              followsActive && canAdvance ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={(e) => { e.stopPropagation(); handleAdvance(rotation.id); }}
                                  disabled={isBusy}
                                  aria-label={`Advance to ${username} in ${rotation.name}`}
                                  title={`Advance to ${username}`}
                                >
                                  <FastForward className="h-3 w-3" />
                                </Button>
                              ) : (
                                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                              )
                            )}
                            <div
                              className={`rounded border px-2 py-1 ${isActive ? 'border-primary' : 'border-border'}`}
                              style={isActive ? { background: 'rgba(0,240,255,0.08)', boxShadow: '0 0 8px rgba(0,240,255,0.18)' } : undefined}
                            >
                              <UserAvatar inline username={username} avatarUrl={collab?.avatarUrl} title={username} />
                            </div>
                            {showTrailingAdvance && (
                              <Button
                                type="button"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={(e) => { e.stopPropagation(); handleAdvance(rotation.id); }}
                                disabled={isBusy}
                                aria-label={`Advance to ${username} in ${rotation.name}`}
                                title={`Advance to ${username}`}
                              >
                                <FastForward className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <CreateEditGreenkeepingRotationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={setGreenkeepingRotations}
      />

      {editingRotation && (
        <CreateEditGreenkeepingRotationDialog
          open={!!editingRotation}
          onOpenChange={(open) => { if (!open) setEditingRotation(null); }}
          rotation={editingRotation}
          onSaved={setGreenkeepingRotations}
          onDeleted={(rotationId) => {
            setActionError('');
            setGreenkeepingRotations(greenkeepingRotations.filter((r) => r.id !== rotationId));
            setEditingRotation(null);
          }}
        />
      )}
    </div>
  );
}
