import { useEffect, useState } from 'react';
import { ChevronRight, ExternalLink, FastForward, HelpCircle, Plus, Sprout } from 'lucide-react';
import { PageTitle } from '@/components/ui/PageTitle';
import { Popup } from '@/components/ui/popup';
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
  const [showHelpDialog, setShowHelpDialog] = useState(false);
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
      <PageTitle
        icon={<Sprout className="h-4 w-4" />}
        title="Greenkeeping Rotations"
        actions={<>
          <Button variant="ghost" onClick={() => setShowHelpDialog(true)} title="Help">
            <HelpCircle className="h-3.5 w-3.5" />
            Help
          </Button>
          {isCollaborator && (
            <Button variant="default" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Rotation
            </Button>
          )}
        </>}
      />

      <Popup title="How to use Greenkeeping Rotations" open={showHelpDialog} onOpenChange={setShowHelpDialog} className="max-w-sm">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
          <p><span className="text-foreground font-medium">Greenkeeping Rotations</span> define recurring duty cycles among collaborators — for example, who is on-call or responsible for a recurring task this week.</p>
          <p>Each rotation has an ordered list of collaborators. The <span className="text-foreground font-medium">active entry</span> is highlighted with a glowing border. Click the <span className="text-foreground font-medium">advance</span> button between entries to move to the next person.</p>
          <p>Rotations can be scoped to one or more <span className="text-foreground font-medium">groups</span> and optionally include a link to a schedule or document.</p>
          <p>Click a <span className="text-foreground font-medium">rotation card</span> to edit its name, description, link, collaborator order, or assigned groups.</p>
        </div>
      </Popup>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
            {sortedRotations.map((rotation) => {
              const activeEntry = getActiveGreenkeepingEntry(rotation);
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
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 w-full">
                    <span className="font-medium text-lg text-foreground w-full">{rotation.name}</span>
                    {groups.length > 0 && (
                      <div className="flex flex-wrap gap-1 sm:justify-end sm:shrink-0">
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
                      className="flex items-center gap-1 mt-0.5 text-xs text-[hsl(185,100%,54%)] hover:underline w-full min-w-0"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate min-w-0 flex-1">{rotation.link}</span>
                    </a>
                  )}

                  {/* Rotation order */}
                  {rotation.collaborators.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 mt-2 w-full">
                      {rotation.collaborators.map((entry) => {
                        const collab = collaboratorMap[entry.collaboratorId];
                        const username = collab?.username ?? 'Unknown';
                        const isActive = activeEntry?.id === entry.id;

                        return (
                          <div key={entry.id} className="flex items-center gap-1 w-full sm:w-auto">
                            <div
                              className={`rounded border px-2 py-1 flex-1 min-w-0 overflow-hidden ${isActive ? 'border-white' : 'border-border'}`}
                              style={isActive ? { background: 'rgba(0,240,255,0.08)', boxShadow: '0 0 8px rgba(0,240,255,0.18)' } : undefined}
                            >
                              <UserAvatar inline username={username} avatarUrl={collab?.avatarUrl} title={username} />
                            </div>
                            {isActive && canAdvance ? (
                              <Button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleAdvance(rotation.id); }}
                                disabled={isBusy}
                                aria-label={`Advance rotation ${rotation.name}`}
                                title="Advance"
                              >
                                <FastForward className="h-3 w-3" />
                              </Button>
                            ) :
                              <Button variant="ghost" className="pointer-events-none cursor-default text-muted-foreground/50" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            }
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
