import { useEffect, useState } from 'react';
import { ExternalLink, FastForward, HelpCircle, ListChecks, Plus, Sprout } from 'lucide-react';
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
import GreenkeepingTasklistDialog from './GreenkeepingTasklistDialog';

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
  const [tasklistRotation, setTasklistRotation] = useState<GreenkeepingRotation | null>(null);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [actionError, setActionError] = useState('');
  const [busyRotationId, setBusyRotationId] = useState<string | null>(null);
  const [pendingAdvance, setPendingAdvance] = useState<{
    rotationId: string;
    rotationName: string;
    nextUsername: string;
    nextAvatarUrl?: string | null;
  } | null>(null);

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

  const cardBtnCls = 'flex items-center gap-1.5 px-3 text-xs text-foreground bg-secondary/70 hover:text-muted-foreground hover:bg-secondary border-l border-border transition-colors cursor-pointer shrink-0';

  return (
    <div className="flex h-full flex-col overflow-y-auto">

      <Popup title="How to use Greenkeeping Rotations" open={showHelpDialog} onOpenChange={setShowHelpDialog} className="max-w-sm">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
          <p><span className="text-foreground font-medium">Greenkeeping Rotations</span> define recurring duty cycles among collaborators — for example, who is on-call or responsible for a recurring task this week.</p>
          <p>Each rotation has an ordered list of collaborators. The <span className="text-foreground font-medium">active entry</span> is highlighted with a glowing border. Click the <span className="text-foreground font-medium">advance</span> button between entries to move to the next person.</p>
          <p>Rotations can be scoped to one or more <span className="text-foreground font-medium">groups</span> and optionally include a link to a schedule or document.</p>
          <p>Click a <span className="text-foreground font-medium">rotation card</span> to edit its name, description, link, collaborator order, or assigned groups.</p>
        </div>
      </Popup>

      <Popup
        title="Advance rotation"
        open={!!pendingAdvance}
        onOpenChange={(open) => { if (!open) setPendingAdvance(null); }}
        className="max-w-xs"
      >
        {pendingAdvance && (
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-sm text-muted-foreground text-center">
              Next up in <span className="font-semibold text-foreground">{pendingAdvance.rotationName}</span>:
            </p>
            <UserAvatar
              username={pendingAdvance.nextUsername}
              avatarUrl={pendingAdvance.nextAvatarUrl || undefined}
              className="py-1"
              title={pendingAdvance.nextUsername}
            />
            <div className="flex gap-2 w-full">
              <Button
                variant="ghost"
                fullWidth={true}
                onClick={() => setPendingAdvance(null)}
              >
                Cancel
              </Button>
              <Button
                fullWidth={true}
                disabled={busyRotationId === pendingAdvance.rotationId}
                onClick={() => {
                  const id = pendingAdvance.rotationId;
                  setPendingAdvance(null);
                  handleAdvance(id);
                }}
                className="gap-1.5"
              >
                <FastForward className="h-4 w-4" />
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Popup>

      {/* ── Main card ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col rounded-lg bg-card overflow-hidden mx-3 sm:mx-6 my-3">

        {/* Card header */}
        <div className="flex items-stretch border-b border-border shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground flex-1">
            <Sprout className="h-3.5 w-3.5 text-muted-foreground" />
            Greenkeeping Rotations
          </div>
          <button className={cardBtnCls} onClick={() => setShowHelpDialog(true)}>
            <HelpCircle className="h-3.5 w-3.5" /> Help
          </button>
          {isCollaborator && (
            <button className={cardBtnCls} onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Rotation
            </button>
          )}
        </div>

        {(greenkeepingRotationsError || actionError) && (
          <p className="px-4 py-2 text-sm text-destructive shrink-0">{greenkeepingRotationsError || actionError}</p>
        )}

        {greenkeepingRotationsLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : sortedRotations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          No greenkeeping rotations yet.{isCollaborator ? ' Create one with "Rotation".' : ''}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="greenkeeping-table data-display-table w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-2 font-medium data-sticky-header w-2/5">Rotation</th>
                <th className="text-left px-4 py-2 font-medium data-sticky-header">Greenkeeper</th>
                <th className="text-left px-4 py-2 font-medium data-sticky-header">Checklist</th>
              </tr>
            </thead>
            <tbody>
              {sortedRotations.map((rotation) => {
                const activeEntry = getActiveGreenkeepingEntry(rotation);
                const groups = rotation.groupIds.map((gid) => currentMap.groups[gid]).filter(Boolean);
                const isBusy = busyRotationId === rotation.id;
                const canAdvance = isCollaborator && rotation.collaborators.length > 1;

                return (
                  <tr
                    key={rotation.id}

                  >
                    {/* Left: rotation metadata */}
                    <td className="px-4 py-3 align-top border-b border-border">
                      <div className="font-semibold text-lg cursor-pointer text-link-hover"
                           onClick={() => { if (isCollaborator) { setActionError(''); setEditingRotation(rotation); } }}
                      >{rotation.name}</div>
                      {rotation.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{rotation.description}</p>
                      )}
                      {rotation.link && (
                        <a
                          href={rotation.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 mt-1 text-xs text-link hover:underline min-w-0"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate min-w-0">{rotation.link}</span>
                        </a>
                      )}
                      {groups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {groups.map((g) => (
                            <span key={g.id} className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-xs text-foreground">
                              <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                              {g.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Middle: current greenkeeper with advance on click */}
                    <td className="px-4 py-3 align-middle border-b border-border" onClick={(e) => e.stopPropagation()}>
                      {activeEntry ? (() => {
                        const collab = collaboratorMap[activeEntry.collaboratorId];
                        const username = collab?.username ?? 'Unknown';
                        const activeIdx = rotation.collaborators.findIndex((e) => e.id === activeEntry.id);
                        const nextEntry = rotation.collaborators[(activeIdx + 1) % rotation.collaborators.length];
                        const nextCollab = collaboratorMap[nextEntry?.collaboratorId];
                        const nextUsername = nextCollab?.username ?? 'Unknown';

                        return (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (canAdvance) {
                                  setPendingAdvance({
                                    rotationId: rotation.id,
                                    rotationName: rotation.name,
                                    nextUsername,
                                    nextAvatarUrl: nextCollab?.avatarUrl,
                                  });
                                }
                              }}
                              disabled={!canAdvance || isBusy}
                              aria-label={canAdvance ? `Advance rotation ${rotation.name}` : `Current greenkeeper ${username}`}
                              title={canAdvance ? `Current: ${username}. Click to advance to next.` : username}
                              className={` px-2 py-1 w-24 min-w-24 flex items-center justify-center tr`}

                            >
                              <UserAvatar username={username} avatarUrl={collab?.avatarUrl} title={username} fullWidth={true} />
                            </button>
                          </div>
                        );
                      })() : (
                        <span className="text-xs text-muted-foreground italic">No assignees</span>
                      )}
                    </td>

                    {/* Right: current checklist or button to create one */}
                    <td className="px-4 py-3 align-middle border-b border-border" onClick={(e) => e.stopPropagation()}>
                      {rotation.currentChecklist ? (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() => setTasklistRotation(rotation)}
                            className="h-7 text-xs gap-1.5 px-2.5 text-foreground cursor-pointer"
                            aria-label={`Open checklist for ${rotation.name}`}
                            title={`Checklist: ${rotation.currentChecklist.title}`}
                          >
                            <ListChecks className="h-3.5 w-3.5" />
                            {rotation.currentChecklist.title || 'Checklist (Active)'}
                          </Button>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {rotation.currentChecklist.items.filter((i) => i.done).length}/{rotation.currentChecklist.items.length} done
                          </span>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={() => setTasklistRotation(rotation)}
                          className="h-7 text-xs gap-1.5 px-2.5 text-foreground cursor-pointer"
                          aria-label={`Open checklist for ${rotation.name}`}
                          title="Create checklist"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create checklist
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      </div>{/* end card */}

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

      {tasklistRotation && (
        <GreenkeepingTasklistDialog
          open={!!tasklistRotation}
          onOpenChange={(open) => { if (!open) setTasklistRotation(null); }}
          rotation={tasklistRotation}
        />
      )}
    </div>
  );
}
