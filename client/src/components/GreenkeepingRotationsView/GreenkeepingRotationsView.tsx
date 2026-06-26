import { useEffect, useState } from 'react';
import { ChevronRight, FastForward, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
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

  const collaboratorMap = Object.fromEntries(currentMap.collaborators.map((collaborator) => [collaborator.id, collaborator]));
  const sortedRotations = [...greenkeepingRotations].sort((a, b) => a.name.localeCompare(b.name));

  const handleAdvance = async (rotationId: string) => {
    setBusyRotationId(rotationId);
    setActionError('');
    try {
      const updated = await advanceGreenkeepingRotation(currentMap.id, rotationId);
      setGreenkeepingRotations(greenkeepingRotations.map((rotation) => rotation.id === updated.id ? updated : rotation));
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
          No greenkeeping rotations yet.{isCollaborator ? ' Create one with “Rotation”.' : ''}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="min-w-max">
            <table className="data-display-table w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="data-sticky-header min-w-72 border-b border-border bg-card px-6 py-2 text-left font-medium text-muted-foreground sticky top-0 z-10">
                    Rotation
                  </th>
                  <th className="data-sticky-header min-w-52 border-b border-border bg-card px-4 py-2 text-left font-medium text-muted-foreground sticky top-0 z-10">
                    Groups
                  </th>
                  <th className="data-sticky-header min-w-md border-b border-border bg-card px-4 py-2 text-left font-medium text-muted-foreground sticky top-0 z-10">
                    Active / Rotation Order
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRotations.map((rotation) => {
                  const activeEntry = getActiveGreenkeepingEntry(rotation);
                  const activeIndex = activeEntry
                    ? rotation.collaborators.findIndex((entry) => entry.id === activeEntry.id)
                    : -1;
                  const groups = rotation.groupIds.map((groupId) => currentMap.groups[groupId]).filter(Boolean);
                  const isBusy = busyRotationId === rotation.id;
                  const canAdvanceRotation = isCollaborator && rotation.collaborators.length > 1;

                  return (
                    <tr key={rotation.id} className="transition-colors hover:bg-muted/30">
                      <td className="border-b border-border px-6 py-2.5 align-top w-1/2 max-w-0">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {isCollaborator ? (
                              <button
                                type="button"
                                className="truncate text-sm font-medium text-foreground transition-colors hover:text-[hsl(185,100%,54%)] cursor-pointer"
                                onClick={() => {
                                  setActionError('');
                                  setEditingRotation(rotation);
                                }}
                              >
                                {rotation.name}
                              </button>
                            ) : (
                              <span className="truncate text-sm font-medium text-foreground">{rotation.name}</span>
                            )}
                          </div>
                          {rotation.description && (
                            <p className="mt-1 text-sm text-muted-foreground break-words whitespace-normal w-full">{rotation.description}</p>
                          )}
                          {rotation.link && (
                            <a
                              href={rotation.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block break-all text-sm text-[hsl(185,100%,54%)] hover:underline"
                              title={rotation.link}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {rotation.link}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="border-b border-border px-4 py-2.5 align-top">
                        {groups.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {groups.map((group) => (
                              <span key={group.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-sm text-foreground">
                                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
                                {group.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="data-empty">—</span>
                        )}
                      </td>
                      <td className="border-b border-border px-4 py-2.5 align-top">
                        {rotation.collaborators.length > 0 ? (
                            <div className="flex flex-wrap items-start gap-2">
                              {rotation.collaborators.map((entry, index) => {
                                const collaborator = collaboratorMap[entry.collaboratorId];
                                const username = collaborator?.username ?? 'Unknown';
                                const isActive = activeEntry?.id === entry.id;
                                const followsActive = activeIndex >= 0 && index === activeIndex + 1;
                                const showTrailingAdvance = canAdvanceRotation
                                  && isActive
                                  && activeIndex === rotation.collaborators.length - 1;

                                return (
                                  <div key={entry.id} className="flex items-start gap-2">
                                    {index > 0 && (
                                      followsActive && canAdvanceRotation ? (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="mt-3 h-6 w-6 shrink-0 px-0"
                                          onClick={() => handleAdvance(rotation.id)}
                                          disabled={isBusy || rotation.collaborators.length === 0}
                                          aria-label={`Advance to ${username} in ${rotation.name}`}
                                          title={`Advance to ${username}`}
                                        >
                                          <FastForward className="h-3 w-3" />
                                        </Button>
                                      ) : (
                                        <ChevronRight className="mt-4 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                                      )
                                    )}
                                    <div className="flex w-16 flex-col items-center text-center">
                                      <Avatar
                                        className={`h-10 w-10 rounded-full border ${isActive ? 'border-[hsl(185,100%,54%)] ring-2 ring-[hsl(185,100%,54%,0.18)]' : 'border-border'}`}
                                        title={username}
                                      >
                                        {collaborator?.avatarUrl && <AvatarImage src={collaborator.avatarUrl} alt={username} />}
                                        <AvatarFallback className={`rounded-full text-sm ${isActive ? 'bg-[hsl(185,100%,54%,0.15)] text-[hsl(185,100%,54%)]' : 'bg-secondary text-secondary-foreground'}`}>
                                          {username.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className={`mt-1 line-clamp-2 text-sm ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                        {username}
                                      </span>
                                      {isActive && (
                                        <StatusBadge status="NONE" className="mt-1 px-1.5 py-0 text-sm leading-4">
                                          Active
                                        </StatusBadge>
                                      )}
                                    </div>
                                    {showTrailingAdvance && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="mt-3 h-6 w-6 shrink-0 px-0"
                                        onClick={() => handleAdvance(rotation.id)}
                                        disabled={isBusy || rotation.collaborators.length === 0}
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
                        ) : (
                          <span className="data-empty">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
          onOpenChange={(open) => {
            if (!open) setEditingRotation(null);
          }}
          rotation={editingRotation}
          onSaved={setGreenkeepingRotations}
          onDeleted={(rotationId) => {
            setActionError('');
            setGreenkeepingRotations(greenkeepingRotations.filter((item) => item.id !== rotationId));
            setEditingRotation(null);
          }}
        />
      )}
    </div>
  );
}

