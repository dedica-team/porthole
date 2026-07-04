import {useState, useRef} from 'react';
import {ExternalLink, Check} from 'lucide-react';
import {UserAvatar} from '@/components/ui/user-avatar';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Button} from '@/components/ui/button';
import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {Label} from '@/components/ui/label';
import {StatusBadge, choreStateToStatus} from '@/components/ui/status-badge';
import type {ChoreEntry, ChoreEntryState, ChoreList} from '@/types/chores';
import type {Collaborator} from '@/types/session';
import type {Landmark} from '@/types/landmark';
import {CHORE_ENTRY_STATE_LABEL, CHORE_ENTRY_STATES} from '@/types/chores';
import {updateChoreEntry} from '@/api/mapApi';

interface Props {
    mapId: string;
    listId: string;
    entry: ChoreEntry;
    landmark: Landmark | undefined;
    collaborators: Collaborator[];
    isCollaborator: boolean;
    onUpdated: (updated: ChoreList) => void;
}

export default function ChoreEntryRow({
                                          mapId,
                                          listId,
                                          entry,
                                          landmark,
                                          collaborators,
                                          isCollaborator,
                                          onUpdated
                                      }: Props) {
    const [open, setOpen] = useState(false);
    const [draftState, setDraftState] = useState<ChoreEntryState>(entry.state);
    const [draftAssigneeId, setDraftAssigneeId] = useState<string>(entry.assigneeId ?? '');
    const [draftLink, setDraftLink] = useState(entry.link ?? '');
    const [draftNote, setDraftNote] = useState(entry.note ?? '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openDialog = () => {
        if (open) return;
        setDraftState(entry.state);
        setDraftAssigneeId(entry.assigneeId ?? '');
        setDraftLink(entry.link ?? '');
        setDraftNote(entry.note ?? '');
        setOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await updateChoreEntry(mapId, listId, entry.landmarkId, {
                state: draftState,
                assigneeId: draftAssigneeId || undefined,
                clearAssignee: !draftAssigneeId,
                link: draftLink.trim() || undefined,
                clearLink: !draftLink.trim(),
                note: draftNote.trim() || undefined,
                clearNote: !draftNote.trim(),
            });
            onUpdated(updated);
            setOpen(false);
            setSaved(true);
            if (savedTimer.current) clearTimeout(savedTimer.current);
            savedTimer.current = setTimeout(() => setSaved(false), 1500);
        } catch { /* ignore */
        } finally {
            setSaving(false);
        }
    };

    const assignee = collaborators.find((c) => c.id === entry.assigneeId);
    const landmarkName = landmark?.name ?? entry.landmarkId;

    const stateBorderColor: Record<string, string> = {
        DONE: 'hsl(var(--success))',
        ONGOING: 'hsl(var(--info))',
        BLOCKED: 'hsl(var(--destructive))',
        NONE: 'hsl(var(--muted-foreground) / 0.2)',
    };

    const stateBadge = (
        <StatusBadge status={choreStateToStatus[entry.state]} className="text-sm font-medium shrink-0">
            {CHORE_ENTRY_STATE_LABEL[entry.state]}
        </StatusBadge>
    );

    return (
        <Button variant="ghost" title="Edit entry" onClick={(e) => {
            if (isCollaborator) {
                e.stopPropagation();
                openDialog();
            }
        }} style={{borderColor: stateBorderColor[entry.state]}}
                className={`group h-full w-full !flex-col !items-start !justify-start !whitespace-normal text-left px-4 py-3 transition-colors `}>
            {/* Title row: name left, status badge right */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 w-full">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {saved && <Check className="h-3 w-3 text-success shrink-0"/>}
                    <span className="font-medium text-lg text-foreground truncate">{landmarkName}</span>
                </div>
                <div className="shrink-0">{stateBadge}</div>
            </div>


            {/* Link + note */}
            {(entry.link || entry.note) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {entry.link && (
                        <a href={entry.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                           className="flex items-center gap-1 text-xs text-[hsl(185,100%,54%)] hover:underline min-w-0 overflow-hidden">
                            <ExternalLink className="h-3 w-3 shrink-0"/>
                            <span className="truncate min-w-0">{entry.link}</span>
                        </a>
                    )}
                    {entry.note && (
                        <span className="text-foreground">{entry.note}</span>
                    )}
                </div>
            )}

            {/* Assignee */}
            {assignee && (
                <UserAvatar inline size="xs" username={assignee.username} avatarUrl={assignee.avatarUrl} className="mt-0.5" />
            )}


            {/* Edit dialog */}
            <Dialog open={open} onOpenChange={(v) => {
                if (!v) setOpen(false);
            }}>
                <DialogContent className="max-w-sm" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="text-sm truncate">{landmarkName}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <Label className="text-sm text-muted-foreground uppercase tracking-wide">State</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {CHORE_ENTRY_STATES.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setDraftState(s)}
                                        className={`transition-opacity cursor-pointer ${draftState === s ? '' : 'opacity-40 hover:opacity-70'}`}
                                    >
                                        <StatusBadge status={choreStateToStatus[s]} className="text-sm font-medium">
                                            {CHORE_ENTRY_STATE_LABEL[s]}
                                        </StatusBadge>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-sm text-muted-foreground uppercase tracking-wide">Assignee</Label>
                            <select
                                value={draftAssigneeId}
                                onChange={(e) => setDraftAssigneeId(e.target.value)}
                                className="h-7 text-sm px-2 rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                                <option value="">Unassigned</option>
                                {collaborators.map((c) => (
                                    <option key={c.id} value={c.id}>{c.username}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-sm text-muted-foreground uppercase tracking-wide">Link</Label>
                            <Input
                                value={draftLink}
                                onChange={(e) => setDraftLink(e.target.value)}
                                placeholder="https://…"
                                className="h-7 text-sm px-2"
                                type="url"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-sm text-muted-foreground uppercase tracking-wide">Note</Label>
                            <Textarea
                                value={draftNote}
                                onChange={(e) => setDraftNote(e.target.value)}
                                placeholder="Note…"
                                className="text-sm resize-none"
                                maxLength={280}
                                rows={2}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <Button fullWidth={true} onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Button>
    );
}
